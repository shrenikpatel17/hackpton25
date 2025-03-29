import mongoose from 'mongoose';

export interface ISession extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  date: Date;
  timeStart: Date;
  timeEnd: Date;
  blinkRate: number;
  ambientLight: string;
  eyePosition: string;
  eyeDistance: number;
}

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true,
  },
  timeStart: {
    type: Date,
    required: true,
  },
  timeEnd: {
    type: Date,
    required: true,
  },
  blinkRate: {
    type: Number,
    required: true,
  },
  ambientLight: {
    type: String,
    required: true,
  },
  eyePosition: {
    type: String,
    required: true,
  },
  eyeDistance: {
    type: Number,
    required: true,
  }
}, {
  timestamps: true,
});

export default mongoose.models.Session || mongoose.model<ISession>('Session', sessionSchema); 