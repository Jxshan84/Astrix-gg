const mongoose = require('mongoose');
const { Schema } = mongoose;

const premiumSchema = new Schema({
  userId: { type: String, required: true, index: true },
  guildId: { type: String, default: null, index: true },
  plan: { type: String, enum: ['premium', 'premium_plus', 'founder'], default: 'premium' },
  active: { type: Boolean, default: true },
  lifetime: { type: Boolean, default: false },
  expiresAt: { type: Date, default: null },
  activatedBy: { type: String, default: null },
  source: { type: String, default: 'astrix_bot' }
}, {
  timestamps: true,
  minimize: false,
  collection: 'premiums'
});

premiumSchema.index({ userId: 1, guildId: 1 });

module.exports = mongoose.models.Premium || mongoose.model('Premium', premiumSchema);
