src/
  app/            # Next.js routes
  components/     # UI components
  features/       # Feature-based modules
  entities/       # Core entities(User, Mafia, Bunker, Player, Items, etc.)
  server/         # Backend logic
  game-engine/    # Game logic(core of the system)
  lib/            # Utilities(Prisma, API clients, mb something more)

prisma/
  schema.prisma   # Database schema

.env              # Environment variables

Note: first variant of project was deleted 'cause i hated the front-end part, so i've decided to start from back-end and then do the front-end part. Functionality >> UI