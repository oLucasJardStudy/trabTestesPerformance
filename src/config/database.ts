import { DataSource } from 'typeorm';

export const MysqlDataSource = new DataSource({
  name: 'default',
  type: 'mysql',
  database: process.env.DB_DATABASE,
  url: process.env.DB_CONNECTION_STRING,
  entities: ['src/endpoints/**/*.entity.ts', 'src/endpoints/**/*.entity.js'],
  logging: process.env.DB_LOGGING === 'true',
  synchronize: true,
  extra: {
    connectionLimit: 10
  }
});
