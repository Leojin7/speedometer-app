
const request = require('supertest');
const app = require('../server');
const { Pool } = require('pg');


jest.mock('pg', () => {
  const mPool = {
    query: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

describe('Speedometer API', () => {
  let pool;

  beforeAll(() => {
    pool = new Pool();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/speed', () => {
    it('should save a new speed reading', async () => {
      const mockSpeed = { speed: 50 };
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, ...mockSpeed }] });

      const res = await request(app)
        .post('/api/speed')
        .send(mockSpeed);

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('speed', 50);
    });

    it('should return 400 for invalid speed', async () => {
      const res = await request(app)
        .post('/api/speed')
        .send({ speed: 'invalid' });

      expect(res.statusCode).toEqual(400);
    });
  });
});