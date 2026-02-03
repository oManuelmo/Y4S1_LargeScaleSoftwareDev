import 'jest';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables for tests
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.development') });

jest.spyOn(console, 'error').mockImplementation(() => {});