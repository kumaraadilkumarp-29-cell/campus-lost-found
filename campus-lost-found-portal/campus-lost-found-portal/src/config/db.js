const mongoose = require('mongoose');

/**
 * One connection call for the whole process. Mongoose queues queries until
 * the connection is ready, so controllers can stay unaware of connection state.
 */
const connectDB = async (uri = process.env.MONGO_URI) => {
  if (!uri) {
    throw new Error('MONGO_URI is not set. Copy .env.example to .env first.');
  }

  mongoose.set('strictQuery', true);

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      family: 4,
    });
    console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    throw new Error(
      `MongoDB connection failed (${error.message}). ` +
        'Check MONGO_URI and, for Atlas, that your IP is on the access list.'
    );
  }
};

module.exports = connectDB;
