const { PrismaClient } = require("@prisma/client");
const { PrismaNeon } = require("@prisma/adapter-neon");
const { Pool, neonConfig } = require("@neondatabase/serverless");
const ws = require("ws");

neonConfig.webSocketConstructor = ws;
const url = new URL(process.env.DATABASE_URL);
url.searchParams.delete("connection_limit");
url.searchParams.delete("pool_timeout");
url.searchParams.delete("connect_timeout");

const pool = new Pool({
  connectionString: url.toString(),
  max: 1,
  connectionTimeoutMillis: 10_000,
});
const prisma = new PrismaClient({ adapter: new PrismaNeon(pool) });

prisma.user
  .count()
  .then((userCount) => console.log(JSON.stringify({ connected: true, userCount })))
  .catch((error) => {
    console.error(`${error.constructor.name}: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
