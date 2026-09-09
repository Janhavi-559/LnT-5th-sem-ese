/**
 * Unique Membership ID Generator
 * Example format: MEM-2026-0001
 */
const User = require('../models/User');

const generateMembershipId = async () => {
  const currentYear = new Date().getFullYear();
  const prefix = `MEM-${currentYear}-`;

  // Find the highest sequence number for the current year
  const latestMember = await User.findOne({
    membershipId: { $regex: `^${prefix}` }
  })
    .sort({ membershipId: -1 })
    .select('membershipId');

  let nextSequence = 1;
  if (latestMember && latestMember.membershipId) {
    const parts = latestMember.membershipId.split('-');
    if (parts.length === 3) {
      const parsedSeq = parseInt(parts[2], 10);
      if (!isNaN(parsedSeq)) {
        nextSequence = parsedSeq + 1;
      }
    }
  }

  const paddedSequence = String(nextSequence).padStart(4, '0');
  return `${prefix}${paddedSequence}`;
};

module.exports = {
  generateMembershipId
};
