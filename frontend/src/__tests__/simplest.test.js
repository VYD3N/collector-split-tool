// The simplest possible Jest test
describe('Simplest Tests', () => {
  test('true is true', () => {
    expect(true).toBe(true);
  });
  
  test('1 + 1 = 2', () => {
    expect(1 + 1).toBe(2);
  });
  
  test('string concatenation works', () => {
    expect('hello ' + 'world').toBe('hello world');
  });
  
  test('arrays work', () => {
    const arr = [1, 2, 3];
    expect(arr.length).toBe(3);
    expect(arr[0]).toBe(1);
  });
}); 