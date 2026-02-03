import { add } from '../utils/operators';
import { isEmail } from '../utils/verifiers';

describe('Utils Module', () => {
  describe('add()', () => {
    it('should correctly add two positive numbers', () => {
      expect(add(2, 3)).toBe(5);
    });

    it('should correctly add a positive and a negative number', () => {
      expect(add(10, -5)).toBe(5);
    });
  });

  describe('isEmail()', () => {
    it('should return true for a valid email', () => {
      expect(isEmail('test@example.com')).toBe(true);
    });

    it('should return false for an invalid email', () => {
      expect(isEmail('not-an-email')).toBe(false);
    });

    it('should return false for an empty string', () => {
      expect(isEmail('')).toBe(false);
    });
  });
});