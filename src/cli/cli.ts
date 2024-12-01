#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import got from 'got';
import { createWriteStream, createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

type MockServerData = {
  titles: string[];
  descriptions: string[];
  cities: string[];
  previewImages: string[];
  propertyTypes: string[];
  features: string[];
  users: {
    name: string;
    email: string;
    avatarUrl: string;
    type: string;
  }[];
  coordinates: {
    [key: string]: {
      latitude: number;
      longitude: number;
      radius: number;
    };
  };
};

const generateRandomNumber = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1) + min);

const getRandomItem = <T>(items: T[]): T =>
  items[Math.floor(Math.random() * items.length)];

const getRandomItems = <T>(items: T[], count: number): T[] => {
  const shuffled = [...items].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

const generateRandomLocation = (center: {
  latitude: number;
  longitude: number;
  radius: number;
}) => {
  // Конвертируем радиус из километров в градусы (приблизительно)
  const radiusInDeg = center.radius / 111;

  const randomAngle = Math.random() * 2 * Math.PI;
  const randomRadius = Math.sqrt(Math.random()) * radiusInDeg;

  return {
    latitude: center.latitude + randomRadius * Math.cos(randomAngle),
    longitude: center.longitude + randomRadius * Math.sin(randomAngle),
  };
};

async function* generateOffers(mockData: MockServerData, count: number) {
  for (let i = 0; i < count; i++) {
    const city = getRandomItem(mockData.cities);
    const cityCoords = mockData.coordinates[city];
    const location = generateRandomLocation(cityCoords);
    const photosCount = generateRandomNumber(3, 6);
    const photos = getRandomItems(mockData.previewImages, photosCount);
    const user = getRandomItem(mockData.users);

    const offer = {
      title: getRandomItem(mockData.titles),
      description: getRandomItem(mockData.descriptions),
      city,
      previewImage: getRandomItem(mockData.previewImages),
      photos: photos.join(';'),
      isPremium: Math.random() < 0.2,
      rating: (Math.random() * 2 + 3).toFixed(1),
      type: getRandomItem(mockData.propertyTypes),
      rooms: generateRandomNumber(1, 5),
      guests: generateRandomNumber(1, 10),
      price: generateRandomNumber(50, 1000),
      features: getRandomItems(
        mockData.features,
        generateRandomNumber(2, 6)
      ).join(';'),
      authorName: user.name,
      authorEmail: user.email,
      authorAvatar: user.avatarUrl,
      authorIsPro: user.type === 'pro',
      latitude: location.latitude.toFixed(6),
      longitude: location.longitude.toFixed(6),
    };

    const row = [
      offer.title,
      offer.description,
      offer.city,
      offer.previewImage,
      offer.photos,
      offer.isPremium,
      offer.rating,
      offer.type,
      offer.rooms,
      offer.guests,
      offer.price,
      offer.features,
      offer.authorName,
      offer.authorEmail,
      offer.authorAvatar,
      offer.authorIsPro,
      offer.latitude,
      offer.longitude,
    ].join('\t');

    yield `${row}\n`;
  }
}

class TSVTransform extends Transform {
  private remainder: string;
  private readonly columns: string[];

  constructor() {
    super();
    this.remainder = '';
    this.columns = [
      'title',
      'description',
      'city',
      'previewImage',
      'photos',
      'isPremium',
      'rating',
      'type',
      'rooms',
      'guests',
      'price',
      'features',
      'authorName',
      'authorEmail',
      'authorAvatar',
      'authorIsPro',
      'latitude',
      'longitude',
    ];
  }

  _transform(
    chunk: Buffer,
    _encoding: string,
    callback: (error?: Error | null) => void
  ) {
    const lines = (this.remainder + chunk.toString()).split('\n');
    this.remainder = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      const values = line.split('\t');
      if (values.length !== this.columns.length) {
        console.error(chalk.yellow(`Warning: Skipping invalid line: ${line}`));
        continue;
      }

      try {
        const offer = Object.fromEntries(
          this.columns.map((key, index) => [key, values[index]])
        );
        this.push(`${JSON.stringify(offer)}\n`);
      } catch (error) {
        console.error(chalk.yellow(`Warning: Failed to parse line: ${line}`));
      }
    }
    callback();
  }

  _flush(callback: (error?: Error | null) => void) {
    if (this.remainder) {
      const values = this.remainder.split('\t');
      if (values.length === this.columns.length) {
        const offer = Object.fromEntries(
          this.columns.map((key, index) => [key, values[index]])
        );
        this.push(`${JSON.stringify(offer)}\n`);
      }
    }
    callback();
  }
}

const handleGenerateCommand = async (
  count: number,
  filepath: string,
  url: string
) => {
  try {
    console.log(chalk.blue('Fetching data from'), chalk.yellow(url));

    // Получаем все необходимые данные параллельно
    const [
      titles,
      descriptions,
      cities,
      previewImages,
      propertyTypes,
      features,
      users,
      coordinates,
    ] = await Promise.all([
      got(`${url}/titles`).json(),
      got(`${url}/descriptions`).json(),
      got(`${url}/cities`).json(),
      got(`${url}/previewImages`).json(),
      got(`${url}/propertyTypes`).json(),
      got(`${url}/features`).json(),
      got(`${url}/users`).json(),
      got(`${url}/coordinates`).json(),
    ]);

    const mockData = {
      titles,
      descriptions,
      cities,
      previewImages,
      propertyTypes,
      features,
      users,
      coordinates,
    } as MockServerData;

    console.log(chalk.blue(`Generating ${count} offers...`));

    const writeStream = createWriteStream(filepath);
    for await (const offerLine of generateOffers(mockData, count)) {
      if (!writeStream.write(offerLine)) {
        await new Promise((resolveWrite) =>
          writeStream.once('drain', resolveWrite)
        );
      }
    }
    writeStream.end();

    console.log(chalk.green('\n🎉 Data generation completed!'));
    console.log(chalk.blue(`Generated ${count} offers to ${filepath}`));
  } catch (error) {
    console.error(chalk.red('\nFailed to generate data:'));
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
    throw error;
  }
};

const handleImportCommand = async (filepath: string): Promise<void> => {
  try {
    console.log(chalk.blue('Starting import from'), chalk.yellow(filepath));

    const transform = new TSVTransform();
    await pipeline(createReadStream(filepath), transform, process.stdout);

    console.log(chalk.green('\n🎉 Data imported successfully!'));
  } catch (error) {
    console.error(chalk.red('\nFailed to import data:'));
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
    throw error;
  }
};

const readVersion = async (): Promise<string> => {
  try {
    const packageJsonPath = resolve(__dirname, '../../package.json');
    const content = await readFile(packageJsonPath, 'utf-8');
    return JSON.parse(content).version;
  } catch (error) {
    console.error(chalk.red('Error reading package.json'));
    return 'unknown';
  }
};

const bootstrap = async () => {
  const program = new Command();
  const version = await readVersion();

  program
    .name('six-cities')
    .description('CLI for managing Six Cities rental data')
    .version(version, '-v, --version', 'output the current version');

  program
    .command('generate <count> <filepath> <url>')
    .description('Generate test data and save to file')
    .action(handleGenerateCommand);

  program
    .command('import <filepath>')
    .description('Import data from TSV file')
    .action(handleImportCommand);

  program.parse();
};

bootstrap().catch((error) => {
  console.error(chalk.red('Fatal error:'));
  console.error(error);
  throw error;
});
