# Seeding Note

The seeding scripts (`seed.js` and `reseed.js`) now use in-memory seed data defined in `scripts/seed-data.js`.

## Customising seed data
Update `seed-data.js` to modify:

- Default categories
- Default services (and plans/features)
- Default CodeCanyon scripts
- Default reviews
- Default admin credentials

## Admin credentials
By default, the seeder creates an admin user with:

- Email: `admin@fivedit.com`
- Password: `ChangeMe123!`

Override these by exporting `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your environment before running `npm run seed` or `npm run reseed`.

## Production note
Seeding wipes existing data (truncates tables). Run it only on development or when you intentionally want to reset the database.

