const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

// Safe .env loader to read DATABASE_URL on local machine
try {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        // Remove quotes if present
        if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value;
      }
    });
  }
} catch (e) {
  console.log("Could not load .env file, relying on system env", e);
}

const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const newsData = [
  {
    title: "Система новин із глибокою структурою оновлень",
    description: "Раді представити повноцінний розділ новин на платформі! Тепер ви можете дізнаватися про свіжі оновлення та хронологію змін у преміальному інтерактивному інтерфейсі.",
    size: "major",
    date: new Date("2026-05-20T12:00:00Z"),
    sections: [
      {
        sectionName: "Функціонал сайту",
        subsectionName: "Розширення функціоналу",
        bullets: [
          "Додано нову незалежну модель News у базу даних з підтримкою вкладеного JSON-формату для підновин.",
          "Створено захищений API-ендпоінт /api/news з повною перевіркою авторизації та JWT-сесій.",
          "Розроблено динамічну сторінку /news з адаптивною сіткою та відступами зліва і справа."
        ]
      },
      {
        sectionName: "Функціонал сайту",
        subsectionName: "Покращення інтерфейсу",
        bullets: [
          "Реалізовано скляні (glassmorphic) інтерактивinteractive картки з інтуїтивним підсвічуванням кольором масштабу (зелений для мінорних, синій для мажорних).",
          "Інтегровано мікро-анімації підйому при наведенні миші та плавні акордеони для розгортання тез.",
          "Повністю відмовилися від жорстких текстових ярликів на користь природного візуального дизайну."
        ]
      }
    ]
  },
  {
    title: "AI-асистент у Мафії та оновлений чат",
    description: "Велике оновлення гри \"Мафія\"! Додано інтелектуального RAG-асистента, який знає правила гри, та значно покращено комунікацію між гравцями.",
    size: "major",
    date: new Date("2026-05-11T12:00:00Z"),
    sections: [
      {
        sectionName: "Мафія",
        subsectionName: "AI асистент",
        bullets: [
          "Інтегровано інтелектуального AI-помічника, який використовує базу знань з правил Мафії та FAQ.",
          "Асистент допомагає гравцям розібратися в тонкощах правил у реальному часі."
        ]
      },
      {
        sectionName: "Функціонал сайту",
        subsectionName: "Розширення функціоналу чатів",
        bullets: [
          "Покращено загальну стабільність ігрового чату.",
          "Додано публічний чат для глядачів та вибулих гравців."
        ]
      }
    ]
  },
  {
    title: "Покращення статистики та інтерфейсу",
    description: "Зробили аналітику ігор інформативнішою, а інтерфейс платформи — привабливішим та сучаснішим.",
    size: "minor",
    date: new Date("2026-05-09T15:00:00Z"),
    sections: [
      {
        sectionName: "Статистика",
        subsectionName: "Розширення функціоналу",
        bullets: [
          "Додано нові графіки та аналітичні метрики для детального аналізу результатів ігор.",
          "Оновлено візуалізацію перемог та відсотків ігрових ролей у профілі."
        ]
      },
      {
        sectionName: "Функціонал сайту",
        subsectionName: "Покращення інтерфейсу",
        bullets: [
          "Виправлено дрібні баги відображення інтерфейсу на мобільних пристроях.",
          "Додано плавні анімаційні переходи між екранами."
        ]
      }
    ]
  },
  {
    title: "Статистика гри \"Хто я?\" (Альфа-версія)",
    description: "Перші кроки до глибокого аналізу гри \"Хто я?\".",
    size: "minor",
    date: new Date("2026-05-09T10:00:00Z"),
    sections: [
      {
        sectionName: "Хто я",
        subsectionName: "Розширення функціоналу",
        bullets: [
          "Запущено першу альфа-версію статистики для гри \"Хто я?\".",
          "Статистика наразі доступна ексклюзивно для цього ігрового режиму."
        ]
      },
      {
        sectionName: "Хто я",
        subsectionName: "Покращення інтерфейсу",
        bullets: [
          "Оновлено дизайн ігрового поля для зручнішого перегляду карток інших гравців."
        ]
      }
    ]
  },
  {
    title: "Нові режими у \"Хто я?\" (v0.7)",
    description: "Гнучкі налаштування процесу вгадування та оновлена структура інтерфейсу для гри \"Хто я?\".",
    size: "major",
    date: new Date("2026-05-08T12:00:00Z"),
    sections: [
      {
        sectionName: "Хто я",
        subsectionName: "Розширення функціоналу",
        bullets: [
          "Додано вибір умов завершення гри: \"до переможця\" або \"до програвшого\".",
          "Додано можливість грати з використанням текстового чату або в усному/розмовному форматі.",
          "Додано вибір джерела слів: слова, написані самими гравцями, або згенеровані ШІ."
        ]
      },
      {
        sectionName: "Хто я",
        subsectionName: "Покращення інтерфейсу",
        bullets: [
          "Покращено розділення інтерфейсу на компоненти для швидшого завантаження сторінки.",
          "Додано чат з логом хронології подій в ігровій сесії."
        ]
      }
    ]
  },
  {
    title: "Запуск гри \"Хто я?\" (v0.2) та оновлення лобі",
    description: "Новий ігровий режим \"Хто я?\" тепер доступний у списку лобі разом із редизайном інтерфейсу.",
    size: "major",
    date: new Date("2026-05-06T12:00:00Z"),
    sections: [
      {
        sectionName: "Хто я",
        subsectionName: "Розширення функціоналу",
        bullets: [
          "Додано гру \"Хто я?\" (версія 0.2) з базовою механікою загадування слів іншим гравцям."
        ]
      },
      {
        sectionName: "Функціонал сайту",
        subsectionName: "Покращення інтерфейсу",
        bullets: [
          "Оновлено дизайн сторінки вибору лобі для кращої навігації.",
          "Оновлено загальну структуру сторінок для підготовки до інтеграції наступних ігор."
        ]
      }
    ]
  },
  {
    title: "Тест зв'язку та стабільність Мафії",
    description: "Технічне оновлення, спрямоване на підвищення стабільності з'єднання та виправлення результатів Мафії.",
    size: "minor",
    date: new Date("2026-05-01T12:00:00Z"),
    sections: [
      {
        sectionName: "Функціонал сайту",
        subsectionName: "Розширення функціоналу",
        bullets: [
          "Створено сторінку \"Тест зв'язку\" (communication test) для перевірки пінгу та стабільності з'єднання із сервером."
        ]
      },
      {
        sectionName: "Мафія",
        subsectionName: "Технічні роботи",
        bullets: [
          "Виправлено баг з неправильним нарахуванням результатів гри в Мафії.",
          "Покращено стабільність збереження ігрових сесій у базі даних."
        ]
      }
    ]
  },
  {
    title: "Персональні профілі користувачів",
    description: "Тепер у кожного гравця є власна сторінка профілю зі статистикою та історією ігор.",
    size: "major",
    date: new Date("2026-04-29T12:00:00Z"),
    sections: [
      {
        sectionName: "Функціонал сайту",
        subsectionName: "Розширення функціоналу",
        bullets: [
          "Додано базові сторінки профілів користувачів.",
          "Відображення особистої інформації (ім'я користувача, дата реєстрації, поточний баланс).",
          "Відображення історії останніх зіграних ігор у профілі."
        ]
      }
    ]
  },
  {
    title: "Реліз платформи: Авторизація та Мафія v0.1",
    description: "Офіційний запуск нашої ігрової платформи! Зустить першу версію Мафії та захищену авторизацію.",
    size: "major",
    date: new Date("2026-04-28T12:00:00Z"),
    sections: [
      {
        sectionName: "Функціонал сайту",
        subsectionName: "Розширення функціоналу",
        bullets: [
          "Додано систему реєстрації та авторизації користувачів.",
          "Забезпечено безпечне збереження сесій користувачів у базі даних."
        ]
      },
      {
        sectionName: "Мафія",
        subsectionName: "Розширення функціоналу",
        bullets: [
          "Запущено першу версію Мафії (v0.1) з базовим геймплеєм: розподіл ролей, нічні дії мафії, дона, комісара й лікаря, а також денні обговорення та голосування."
        ]
      }
    ]
  }
];

async function main() {
  console.log("Cleaning database...");
  
  // Clean games/results/lobbies/users to prevent references block during clean install
  await prisma.gameResult.deleteMany();
  await prisma.gamePlayer.deleteMany();
  await prisma.gameSession.deleteMany();
  await prisma.lobbyPlayer.deleteMany();
  await prisma.lobby.deleteMany();
  await prisma.user.deleteMany();
  await prisma.news.deleteMany();

  console.log("Seeding news...");
  for (const item of newsData) {
    await prisma.news.create({
      data: item
    });
  }

  console.log("Seeding test users...");
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  for (let i = 1; i <= 10; i++) {
    const username = `user${i}`;
    const email = `user${i}@example.com`;
    const sex = i <= 5 ? 'male' : 'female';
    
    await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        sex,
        balance: 100
      }
    });
    console.log(`Created user: ${username} (${email})`);
  }

  console.log("Seeding finished successfully!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
