import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Transaction } from '../models/Transaction.js';
import { ExchangeTransaction } from '../models/ExchangeTransaction.js';
import { WantedPost } from '../models/WantedPost.js';
import { Report } from '../models/Report.js';
import {
  ACCOUNT_STATUS,
  USER_ROLES,
  PRODUCT_STATUS,
  LISTING_TYPES,
  TRANSACTION_STATUS,
  TRANSACTION_SOURCE,
  EXCHANGE_TRANSACTION_STATUS,
  WANTED_STATUS,
  REPORT_STATUS,
} from '../constants/index.js';
import { successResponse, errorResponse } from '../utils/response.js';

const MAX_WINDOW_DAYS = 365;

/**
 * Parse and validate optional date range parameters
 */
const parseDateRange = (query) => {
  const { startDate, endDate, timeRange } = query;
  const now = new Date();

  // If timeRange preset is provided
  if (timeRange && !startDate && !endDate) {
    let days = 30;
    if (timeRange === '7d') days = 7;
    else if (timeRange === '14d') days = 14;
    else if (timeRange === '30d') days = 30;
    else if (timeRange === '90d') days = 90;
    else if (timeRange === 'all') days = 365;

    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return {
      start,
      end: now,
      label: timeRange === 'all' ? 'All Time (Past 1 Year)' : `Last ${days} Days`,
    };
  }

  // Default to last 30 days if no custom dates specified
  if (!startDate && !endDate) {
    const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return {
      start: defaultStart,
      end: now,
      label: 'Last 30 Days',
    };
  }

  // Validate custom dates
  const start = startDate ? new Date(startDate) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : now;

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid date format. Expected ISO-8601 date string (e.g. YYYY-MM-DD).');
  }

  if (start > end) {
    throw new Error('startDate cannot be greater than endDate.');
  }

  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > MAX_WINDOW_DAYS) {
    throw new Error(`Date range exceeds the maximum allowed window of ${MAX_WINDOW_DAYS} days.`);
  }

  return {
    start,
    end,
    label: `Custom: ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`,
  };
};

/**
 * Generate an array of continuous date strings YYYY-MM-DD
 */
const generateDateRangeSeries = (startDate, endDate) => {
  const dates = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const finalDate = new Date(endDate);
  finalDate.setHours(23, 59, 59, 999);

  while (current <= finalDate) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

/**
 * Helper to build continuous trend map
 */
const fillTrendGaps = (dates, aggregatedData, valueKey = 'count') => {
  const map = new Map();
  for (const item of aggregatedData) {
    map.set(item._id, item);
  }

  return dates.map((dateStr) => {
    const existing = map.get(dateStr);
    return {
      date: dateStr,
      count: existing ? existing.count || 0 : 0,
      ...(valueKey !== 'count' ? { [valueKey]: existing ? existing[valueKey] || 0 : 0 } : {}),
    };
  });
};

/**
 * GET /api/v1/admin/analytics/overview
 * Comprehensive platform oversight and marketplace analytics
 */
export const getAnalyticsOverview = async (req, res) => {
  try {
    let dateRange;
    try {
      dateRange = parseDateRange(req.query);
    } catch (validationErr) {
      return errorResponse(res, { statusCode: 400, message: validationErr.message });
    }

    const { start: trendStart, end: trendEnd, label: rangeLabel } = dateRange;

    // Parallel aggregate queries across collections
    const [
      userStats,
      listingStats,
      saleTransactionStats,
      exchangeTransactionStats,
      wantedStats,
      reportStats,
      categoryDistribution,
      campusDistribution,
      userTrends,
      listingTrends,
      completedSaleTrends,
      completedExchangeTrends,
    ] = await Promise.all([
      // 1. User metrics
      User.aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
            byRole: [{ $group: { _id: '$role', count: { $sum: 1 } } }],
            verification: [{ $group: { _id: '$isVerified', count: { $sum: 1 } } }],
          },
        },
      ]),

      // 2. Listing metrics
      Product.aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
            byListingType: [{ $group: { _id: '$listingType', count: { $sum: 1 } } }],
          },
        },
      ]),

      // 3. Transactions (Sales and Giveaways)
      Transaction.aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
            completedSales: [
              {
                $match: {
                  status: TRANSACTION_STATUS.COMPLETED,
                  sourceType: { $ne: TRANSACTION_SOURCE.GIVEAWAY_REQUEST },
                  agreedPrice: { $gt: 0 },
                },
              },
              {
                $group: {
                  _id: null,
                  count: { $sum: 1 },
                  totalVolume: { $sum: '$agreedPrice' },
                },
              },
            ],
            completedGiveaways: [
              {
                $match: {
                  status: TRANSACTION_STATUS.COMPLETED,
                  $or: [
                    { sourceType: TRANSACTION_SOURCE.GIVEAWAY_REQUEST },
                    { agreedPrice: 0 },
                  ],
                },
              },
              { $count: 'count' },
            ],
            cancelled: [
              { $match: { status: TRANSACTION_STATUS.CANCELLED } },
              { $count: 'count' },
            ],
            active: [
              {
                $match: {
                  status: {
                    $in: [
                      TRANSACTION_STATUS.PENDING,
                      TRANSACTION_STATUS.CONFIRMED_BY_BUYER,
                      TRANSACTION_STATUS.CONFIRMED_BY_SELLER,
                    ],
                  },
                },
              },
              { $count: 'count' },
            ],
          },
        },
      ]),

      // 4. Exchange Transactions
      ExchangeTransaction.aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            completed: [
              { $match: { status: EXCHANGE_TRANSACTION_STATUS.COMPLETED } },
              { $count: 'count' },
            ],
            cancelled: [
              { $match: { status: EXCHANGE_TRANSACTION_STATUS.CANCELLED } },
              { $count: 'count' },
            ],
            active: [
              {
                $match: {
                  status: {
                    $in: [
                      EXCHANGE_TRANSACTION_STATUS.PENDING,
                      EXCHANGE_TRANSACTION_STATUS.CONFIRMED_BY_PROPOSER,
                      EXCHANGE_TRANSACTION_STATUS.CONFIRMED_BY_OWNER,
                    ],
                  },
                },
              },
              { $count: 'count' },
            ],
          },
        },
      ]),

      // 5. Wanted Posts
      WantedPost.aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          },
        },
      ]),

      // 6. Reports
      Report.aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          },
        },
      ]),

      // 7. Category Distribution
      Product.aggregate([
        {
          $group: {
            _id: '$category',
            totalListings: { $sum: 1 },
            availableListings: {
              $sum: { $cond: [{ $eq: ['$status', PRODUCT_STATUS.AVAILABLE] }, 1, 0] },
            },
            soldListings: {
              $sum: { $cond: [{ $eq: ['$status', PRODUCT_STATUS.SOLD] }, 1, 0] },
            },
          },
        },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'categoryDoc',
          },
        },
        { $unwind: { path: '$categoryDoc', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            categoryId: '$_id',
            name: { $ifNull: ['$categoryDoc.name', 'Uncategorized'] },
            slug: { $ifNull: ['$categoryDoc.slug', 'uncategorized'] },
            totalListings: 1,
            availableListings: 1,
            soldListings: 1,
          },
        },
        { $sort: { totalListings: -1 } },
      ]),

      // 8. Campus Distribution
      Product.aggregate([
        {
          $match: {
            campusLocation: { $exists: true, $ne: '' },
          },
        },
        {
          $group: {
            _id: '$campusLocation',
            listingsCount: { $sum: 1 },
            availableCount: {
              $sum: { $cond: [{ $eq: ['$status', PRODUCT_STATUS.AVAILABLE] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            _id: 0,
            campus: '$_id',
            listingsCount: 1,
            availableCount: 1,
          },
        },
        { $sort: { listingsCount: -1 } },
        { $limit: 10 },
      ]),

      // 9. User Registration Trend
      User.aggregate([
        {
          $match: {
            createdAt: { $gte: trendStart, $lte: trendEnd },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // 10. Listing Creation Trend
      Product.aggregate([
        {
          $match: {
            createdAt: { $gte: trendStart, $lte: trendEnd },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // 11. Completed Sale Transaction Trend
      Transaction.aggregate([
        {
          $match: {
            status: TRANSACTION_STATUS.COMPLETED,
            $expr: {
              $and: [
                {
                  $gte: [
                    { $ifNull: ['$completedAt', '$updatedAt'] },
                    trendStart,
                  ],
                },
                {
                  $lte: [
                    { $ifNull: ['$completedAt', '$updatedAt'] },
                    trendEnd,
                  ],
                },
              ],
            },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: { $ifNull: ['$completedAt', '$updatedAt'] },
              },
            },
            count: { $sum: 1 },
            salesVolume: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$sourceType', TRANSACTION_SOURCE.GIVEAWAY_REQUEST] },
                      { $gt: ['$agreedPrice', 0] },
                    ],
                  },
                  '$agreedPrice',
                  0,
                ],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // 12. Completed Exchange Transaction Trend
      ExchangeTransaction.aggregate([
        {
          $match: {
            status: EXCHANGE_TRANSACTION_STATUS.COMPLETED,
            $expr: {
              $and: [
                {
                  $gte: [
                    { $ifNull: ['$completedAt', '$updatedAt'] },
                    trendStart,
                  ],
                },
                {
                  $lte: [
                    { $ifNull: ['$completedAt', '$updatedAt'] },
                    trendEnd,
                  ],
                },
              ],
            },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: { $ifNull: ['$completedAt', '$updatedAt'] },
              },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Process User Stats
    const rawUsers = userStats[0] || {};
    const totalUsers = rawUsers.total?.[0]?.count || 0;
    const userStatusMap = (rawUsers.byStatus || []).reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});
    const userRoleMap = (rawUsers.byRole || []).reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});
    const verificationMap = (rawUsers.verification || []).reduce((acc, curr) => {
      acc[String(curr._id)] = curr.count;
      return acc;
    }, {});

    const usersData = {
      total: totalUsers,
      active: userStatusMap[ACCOUNT_STATUS.ACTIVE] || 0,
      suspended: userStatusMap[ACCOUNT_STATUS.SUSPENDED] || 0,
      banned: userStatusMap[ACCOUNT_STATUS.BANNED] || 0,
      verified: verificationMap['true'] || 0,
      unverified: verificationMap['false'] || 0,
      byRole: {
        student: userRoleMap[USER_ROLES.STUDENT] || 0,
        admin: userRoleMap[USER_ROLES.ADMIN] || 0,
      },
    };

    // Process Listing Stats
    const rawListings = listingStats[0] || {};
    const totalListings = rawListings.total?.[0]?.count || 0;
    const listingStatusMap = (rawListings.byStatus || []).reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});
    const listingTypeMap = (rawListings.byListingType || []).reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    const listingsData = {
      total: totalListings,
      available: listingStatusMap[PRODUCT_STATUS.AVAILABLE] || 0,
      reserved: listingStatusMap[PRODUCT_STATUS.RESERVED] || 0,
      sold: listingStatusMap[PRODUCT_STATUS.SOLD] || 0,
      inactive: listingStatusMap[PRODUCT_STATUS.INACTIVE] || 0,
      byType: {
        sell: listingTypeMap[LISTING_TYPES.SELL] || 0,
        exchange: listingTypeMap[LISTING_TYPES.EXCHANGE] || 0,
        giveaway: listingTypeMap[LISTING_TYPES.GIVEAWAY] || 0,
      },
    };

    // Process Transaction Stats
    const rawSales = saleTransactionStats[0] || {};
    const rawExchanges = exchangeTransactionStats[0] || {};

    const completedSalesCount = rawSales.completedSales?.[0]?.count || 0;
    const completedSalesVolumeBDT = rawSales.completedSales?.[0]?.totalVolume || 0;
    const completedGiveawaysCount = rawSales.completedGiveaways?.[0]?.count || 0;
    const cancelledSalesCount = rawSales.cancelled?.[0]?.count || 0;
    const activeSalesCount = rawSales.active?.[0]?.count || 0;
    const totalSalesTransactions = rawSales.total?.[0]?.count || 0;

    const completedExchangesCount = rawExchanges.completed?.[0]?.count || 0;
    const cancelledExchangesCount = rawExchanges.cancelled?.[0]?.count || 0;
    const activeExchangesCount = rawExchanges.active?.[0]?.count || 0;
    const totalExchangeTransactions = rawExchanges.total?.[0]?.count || 0;

    const transactionsData = {
      totalSalesTransactions,
      completedSales: completedSalesCount,
      cancelledSales: cancelledSalesCount,
      activeSales: activeSalesCount,
      completedSalesVolumeBDT,
      totalExchangeTransactions,
      completedExchanges: completedExchangesCount,
      cancelledExchanges: cancelledExchangesCount,
      activeExchanges: activeExchangesCount,
      completedGiveaways: completedGiveawaysCount,
      totalCompletedAll: completedSalesCount + completedExchangesCount + completedGiveawaysCount,
      totalCancelledAll: cancelledSalesCount + cancelledExchangesCount,
    };

    // Process Wanted Posts
    const rawWanted = wantedStats[0] || {};
    const totalWanted = rawWanted.total?.[0]?.count || 0;
    const wantedStatusMap = (rawWanted.byStatus || []).reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    const wantedData = {
      total: totalWanted,
      active: wantedStatusMap[WANTED_STATUS.ACTIVE] || 0,
      fulfilled: wantedStatusMap[WANTED_STATUS.FULFILLED] || 0,
      closed: wantedStatusMap[WANTED_STATUS.CLOSED] || 0,
    };

    // Process Reports
    const rawReports = reportStats[0] || {};
    const totalReports = rawReports.total?.[0]?.count || 0;
    const reportStatusMap = (rawReports.byStatus || []).reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    const reportsData = {
      total: totalReports,
      pending: reportStatusMap[REPORT_STATUS.PENDING] || 0,
      reviewed: reportStatusMap[REPORT_STATUS.REVIEWED] || 0,
      resolved: reportStatusMap[REPORT_STATUS.RESOLVED] || 0,
      dismissed: reportStatusMap[REPORT_STATUS.DISMISSED] || 0,
    };

    // Continuous Daily Series for Trend Visualizations
    const dateSeries = generateDateRangeSeries(trendStart, trendEnd);
    const continuousUserRegistrations = fillTrendGaps(dateSeries, userTrends, 'count');
    const continuousNewListings = fillTrendGaps(dateSeries, listingTrends, 'count');

    // Combine completed transactions for daily trends
    const saleMap = new Map((completedSaleTrends || []).map((t) => [t._id, t]));
    const exchangeMap = new Map((completedExchangeTrends || []).map((t) => [t._id, t]));

    const continuousCompletedTransactions = dateSeries.map((d) => {
      const s = saleMap.get(d);
      const e = exchangeMap.get(d);
      const salesCount = s ? s.count || 0 : 0;
      const exchangesCount = e ? e.count || 0 : 0;
      const salesVolume = s ? s.salesVolume || 0 : 0;
      return {
        date: d,
        count: salesCount + exchangesCount,
        salesCount,
        exchangesCount,
        salesVolume,
      };
    });

    const responsePayload = {
      generatedAt: new Date().toISOString(),
      timeRange: {
        startDate: trendStart.toISOString(),
        endDate: trendEnd.toISOString(),
        label: rangeLabel,
      },
      users: usersData,
      listings: listingsData,
      transactions: transactionsData,
      wantedPosts: wantedData,
      reports: reportsData,
      trends: {
        userRegistrations: continuousUserRegistrations,
        newListings: continuousNewListings,
        completedTransactions: continuousCompletedTransactions,
      },
      categoryDistribution: categoryDistribution || [],
      campusDistribution: campusDistribution || [],
    };

    return successResponse(res, {
      data: responsePayload,
      message: 'Platform analytics retrieved successfully',
    });
  } catch (err) {
    console.error('Error fetching admin analytics overview:', err);
    return errorResponse(res, {
      statusCode: 500,
      message: 'Failed to fetch platform analytics overview',
      errors: err.message,
    });
  }
};
