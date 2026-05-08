const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

describe('Auth helpers', () => {
  const SECRET = 'test-secret';

  it('JWT round-trip giữ payload', () => {
    const token = jwt.sign({ id: 1, username: 'a', role: 'admin' }, SECRET, { expiresIn: '1h' });
    const decoded = jwt.verify(token, SECRET);
    expect(decoded.id).toBe(1);
    expect(decoded.username).toBe('a');
    expect(decoded.role).toBe('admin');
  });

  it('JWT verify fail với wrong secret', () => {
    const token = jwt.sign({ id: 1 }, SECRET);
    expect(() => jwt.verify(token, 'wrong')).toThrow();
  });

  it('bcrypt hash + compare', async () => {
    const hash = await bcrypt.hash('123456', 4);
    expect(await bcrypt.compare('123456', hash)).toBe(true);
    expect(await bcrypt.compare('wrong', hash)).toBe(false);
  });
});
