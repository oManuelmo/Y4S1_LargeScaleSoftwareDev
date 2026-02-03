import { createClient, RedisClientType } from 'redis';
import { config } from "dotenv";
import "reflect-metadata";

config();

if (process.env.NODE_ENV !== 'production') {
  config({ path: `.env.development` });
}

const isProduction = process.env.NODE_ENV === "production";
console.log("Environment:", isProduction ? "Production" : "Development");

export class RedisDataSource {
  private static instance: RedisDataSource;
  private client: RedisClientType;

  private constructor() {
    this.client = createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
      },
      password: process.env.REDIS_PASSWORD || 'myredis',
    });

    this.client.on('error', (err) => console.error('Redis Client Error', err));
    this.client.on('connect', () => console.log('Redis Client Connected'));
  }

  public static getInstance(): RedisDataSource {
    if (!RedisDataSource.instance) {
      RedisDataSource.instance = new RedisDataSource();
    }
    return RedisDataSource.instance;
  }

  public async connect(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  public async disconnect(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.disconnect();
    }
  }

  public getClient(): RedisClientType {
    return this.client;
  }

  public async getUserRecommendations(userId: string): Promise<any[]> {
    const key = `recommendations:${userId}`;
    try {
      const data = await this.client.get(key);
      return data && typeof data === 'string' ? JSON.parse(data) : [];
    } catch (error) {
      console.error(`Error getting recommendations for user ${userId}:`, error);
      return [];
    }
  }
  public async getPopularProducts(): Promise<any[]> {
    const key = `recommendations:global:popular`;
    try {
      const data = await this.client.get(key);
      return data && typeof data === 'string' ? JSON.parse(data) : [];
    } catch (error) {
      console.error(`Error getting popular products:`, error);
      return [];
    }
  }
}

export const redisDataSource = RedisDataSource.getInstance();