import sqlite3 from 'sqlite3';
import { TradingPosition } from '@/config/trading';

class DatabaseService {
  private db: sqlite3.Database;

  constructor(dbPath: string = 'trading.db') {
    this.db = new sqlite3.Database(dbPath);
    this.initializeTables();
  }

  private initializeTables() {
    this.db.serialize(() => {
      // Trading positions table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS positions (
          id TEXT PRIMARY KEY,
          token TEXT NOT NULL,
          amount REAL NOT NULL,
          purchase_price REAL NOT NULL,
          purchase_time TEXT NOT NULL,
          sell_time TEXT,
          sell_price REAL,
          profit REAL,
          tweet TEXT NOT NULL,
          influencer TEXT NOT NULL,
          profile_image_url TEXT,
          status TEXT NOT NULL DEFAULT 'holding'
        )
      `);

      // Tweet tracking table (to avoid duplicate processing)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS processed_tweets (
          tweet_id TEXT PRIMARY KEY,
          processed_at TEXT NOT NULL
        )
      `);

      // Ensure new columns exist for existing databases
      this.db.run(`ALTER TABLE positions ADD COLUMN profile_image_url TEXT`, err => {
        if (err && !err.message.includes('duplicate column')) {
          console.error('Failed adding profile_image_url column:', err.message);
        }
      });
    });
  }

  async savePosition(position: TradingPosition): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO positions (
          id, token, amount, purchase_price, purchase_time,
          sell_time, sell_price, profit, tweet, influencer, profile_image_url, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          position.id,
          position.token,
          position.amount,
          position.purchasePrice,
          position.purchaseTime.toISOString(),
          position.sellTime?.toISOString(),
          position.sellPrice,
          position.profit,
          position.tweet,
          position.influencer,
          position.profileImageUrl,
          position.status
        ],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async updatePosition(positionId: string, updates: Partial<TradingPosition>): Promise<void> {
    const fields = [];
    const values = [];

    if (updates.sellTime) {
      fields.push('sell_time = ?');
      values.push(updates.sellTime.toISOString());
    }
    if (updates.sellPrice !== undefined) {
      fields.push('sell_price = ?');
      values.push(updates.sellPrice);
    }
    if (updates.profit !== undefined) {
      fields.push('profit = ?');
      values.push(updates.profit);
    }
    if (updates.status) {
      fields.push('status = ?');
      values.push(updates.status);
    }

    if (fields.length === 0) return;

    values.push(positionId);

    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE positions SET ${fields.join(', ')} WHERE id = ?`,
        values,
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async getHoldingPositions(): Promise<TradingPosition[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        "SELECT * FROM positions WHERE status = 'holding'",
        [],
        (err, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            const positions = rows.map(row => ({
              id: row.id,
              token: row.token,
              amount: row.amount,
              purchasePrice: row.purchase_price,
              purchaseTime: new Date(row.purchase_time),
              sellTime: row.sell_time ? new Date(row.sell_time) : undefined,
              sellPrice: row.sell_price,
              profit: row.profit,
              tweet: row.tweet,
              influencer: row.influencer,
              profileImageUrl: row.profile_image_url ?? undefined,
              status: row.status
            }));
            resolve(positions);
          }
        }
      );
    });
  }

  async hasHoldingPosition(token: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT 1 FROM positions WHERE status = 'holding' AND token = ? LIMIT 1",
        [token],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(Boolean(row));
          }
        }
      );
    });
  }

  async markTweetAsProcessed(tweetId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        "INSERT OR IGNORE INTO processed_tweets (tweet_id, processed_at) VALUES (?, ?)",
        [tweetId, new Date().toISOString()],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async isTweetProcessed(tweetId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT tweet_id FROM processed_tweets WHERE tweet_id = ?",
        [tweetId],
        (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        }
      );
    });
  }

  async getActionableTweets(): Promise<Array<{
    id: string;
    token: string;
    tweet: string;
    influencer: string;
    purchaseTime: Date;
    amount: number;
    status: string;
    profileImageUrl?: string;
  }>> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT id, token, tweet, influencer, purchase_time, amount, status, profile_image_url
         FROM positions
         ORDER BY purchase_time DESC
         LIMIT 10`,
        [],
        (err, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            const tweets = rows.map(row => ({
              id: row.id,
              token: row.token,
              tweet: row.tweet,
              influencer: row.influencer,
              purchaseTime: new Date(row.purchase_time),
              amount: row.amount,
              status: row.status,
              profileImageUrl: row.profile_image_url ?? undefined
            }));
            resolve(tweets);
          }
        }
      );
    });
  }

  close() {
    this.db.close();
  }
}

export const database = new DatabaseService();
