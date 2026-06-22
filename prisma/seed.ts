import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    console.error('❌ 请设置 ADMIN_PASSWORD 环境变量');
    process.exit(1);
  }

  const existing = await prisma.player.findUnique({ where: { id: username } });
  if (existing) {
    console.log(`⚠️  管理员 "${username}" 已存在，跳过创建`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.player.create({
    data: {
      id: username,
      passwordHash,
      isAdmin: true,
      nickname: '管理员',
    },
  });

  console.log(`✅ 管理员 "${username}" 创建成功`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
