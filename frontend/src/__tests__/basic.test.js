// Basic tests to verify Jest is working
describe('Basic Tests', () => {
  test('true is true', () => {
    expect(true).toBe(true);
  });
  
  test('numbers add up correctly', () => {
    expect(1 + 1).toBe(2);
  });
  
  test('objects can be compared', () => {
    const obj = { name: 'test' };
    expect(obj).toEqual({ name: 'test' });
  });
}); 