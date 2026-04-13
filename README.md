# Family Budget Backend

Node.js + Express + PostgreSQL + Prisma backend for family budget management.

## Основной функционал

- Регистрация и логин пользователей (`/auth/register`, `/auth/login`)
- Доходы и расходы (`/operations`)
- Категории (`/categories`)
- Семейные группы с ролями (`/families`)
- Лимиты и блокировки незапланированных операций (модель `Limit`)
- Аналитика по категориям (`/analytics/summary`)

## Запуск

1. Скопируйте `.env.example` в `.env` и задайте `DATABASE_URL`, `JWT_SECRET`, `PORT`.
2. Установите зависимости:

```bash
npm install
```

3. Сгенерируйте Prisma client и создайте миграции (только файлы, без применения к БД):

```bash
npm run prisma:migrate
npm run prisma:generate
```

4. Запуск в режиме разработки:

```bash
npm run dev
```

