/**
 * Formats a pricing object into a display string for the UI.
 * Handles currencies, starting at indicators, and periods.
 * @param {Object} pricingObj - The pricing object from the DB.
 * @param {number} pricingObj.amount - The price amount.
 * @param {string} pricingObj.currency - Currency code (e.g., 'INR', 'USD').
 * @param {string} pricingObj.period - 'one-time', 'monthly', 'yearly'.
 * @param {boolean} pricingObj.isStartingAt - Whether to append '+'.
 * @returns {string} Formatted price string (e.g., '₹15,000+', '₹30,000/mo').
 */
export const formatPricing = (pricingObj) => {
  if (!pricingObj || typeof pricingObj.amount !== 'number') return 'Custom';

  const { amount, currency = 'INR', period = 'one-time', isStartingAt = false } = pricingObj;

  // Format currency
  let formattedAmount;
  try {
    formattedAmount = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0
    }).format(amount);
  } catch (e) {
    // Fallback if formatting fails
    formattedAmount = `₹${amount.toLocaleString('en-IN')}`;
  }

  // Handle "starting at"
  if (isStartingAt) {
    formattedAmount += '+';
  }

  // Handle period
  if (period === 'monthly') {
    formattedAmount += '/mo';
  } else if (period === 'yearly') {
    formattedAmount += '/yr';
  }

  return formattedAmount;
};
