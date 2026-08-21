// PR/commit table pagination limits, shared between the route validators
// (routes/analytics.js) and the controllers that enforce them
// (controllers/analyticsController.js) so the two can't drift apart.
export const DEFAULT_TABLE_LIMIT = 25;
export const MAX_TABLE_LIMIT = 100;
