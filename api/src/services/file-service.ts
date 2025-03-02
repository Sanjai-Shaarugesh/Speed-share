import { db, files } from '../db';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { scanFile } from './virus-scanner';
