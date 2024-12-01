#!/usr/bin/env node

import chalk from 'chalk';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { Command } from 'commander';

const handleImportCommand = async (filepath: string): Promise<void> => {
  try {
    const content = await readFile(resolve(filepath), 'utf-8');
    const rows = content.split('\n');
    const data = rows.map((row) => {
      const [title, description, city, previewImage, photos, isPremium, rating, type, rooms, guests, price, features, authorName, authorEmail, authorAvatar, authorIsPro, lat, lon] = row.split('\t');
      
      return {
        title,
        description,
        city,
        previewImage,
        photos: photos.split(';'),
        isPremium: isPremium === 'true',
        rating: Number(rating),
        type,
        rooms: Number(rooms),
        guests: Number(guests),
        price: Number(price),
        features: features.split(';'),
        author: {
          name: authorName,
          email: authorEmail,
          avatarUrl: authorAvatar,
          isPro: authorIsPro === 'true'
        },
        location: {
          latitude: Number(lat),
          longitude: Number(lon)
        }
      };
    });

    console.log(chalk.green('🎉 Data imported successfully!'));
    console.log(chalk.blue(`Total offers imported: ${data.length}`));
  } catch (error) {
    console.error(chalk.red('Failed to import data:'), error);
  }
};

const readVersion = async (): Promise<string> => {
  const packageJson = await readFile(resolve('./package.json'), 'utf-8');
  return JSON.parse(packageJson).version;
};

const bootstrap = async () => {
  const program = new Command();
  const version = await readVersion();

  program
    .name('six-cities')
    .description('CLI for managing Six Cities rental data')
    .version(version, '-v, --version', 'output the current version');

  program
    .command('import <filepath>')
    .description('Import data from TSV file')
    .action(handleImportCommand);

  program.parse();
};

bootstrap();