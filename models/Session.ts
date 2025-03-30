import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  endTime: {
    type: Date,
    required: true
  },

  // Direction changes array exactly matching your Python output
  directionChanges: [{
    looking_away: Number,  // 0 - looking center or 1 - looking away
    timestamp: Number     // Unix timestamp from time.time()
  }],

  // Blink timestamps from detect-blink endpoint

  blinkTimestamps: [Number],

  // Ambient light state changes from detect-ambient-light endpoint
  lightStateChanges: [{
    ambient_light: String,    // "bright" or "dark"
    timestamp: Number         // Unix timestamp from time.time()
  }],

  // Distance changes from check-distance endpoint
  distanceChanges: [{
    distance: String, // "close", "med", "far"
    start_time: Number,
    end_time: Number
  }],

  // Session statistics
  stats: {
    totalBlinks: {
      type: Number,
      default: 0
    },
    avgBlinkRate: {
      type: Number,
      default: 0
    },
    totalLookAwayTime: {
      type: Number,
      default: 0
    },
    avgDistance: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

export interface ISession extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  startTime: Date;
  endTime: Date;
  directionChanges: Array<{
    looking_away: number;
    timestamp: number;
  }>;
  
  blinkTimestamps: number[];
  
  lightStateChanges: Array<{
    ambient_light: string;
    timestamp: number;
  }>;
  
  distanceChanges: Array<{
    distance: string;
    start_time: number;
    end_time: number;
  }>;
//   stats: {
//     totalBlinks: number;
//     avgBlinkRate: number;
//     totalLookAwayTime: number;
//     avgDistance: number;
//   };
}

export default mongoose.models.Session || mongoose.model<ISession>('Session', sessionSchema); 