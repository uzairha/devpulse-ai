import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import config from './config/index.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import reposRouter from './routes/repos.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

app.use(cors({ origin: config.clientUrl }));
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/repos', reposRouter);

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port} [${config.nodeEnv}]`);
});
