-- Usuário de teste para o Orbit Panel.
-- Login: teste@orbit.local
-- Senha: Teste@123456
-- Hash Argon2id gerado pela mesma biblioteca usada pela aplicação.

INSERT INTO "User" (
  "id",
  "name",
  "email",
  "passwordHash",
  "role",
  "status",
  "mustChangePassword",
  "createdAt",
  "updatedAt"
)
VALUES (
  '0199f31b-57ad-7746-b061-2c44c6c2e497',
  'Usuário de teste',
  'teste@orbit.local',
  '$argon2id$v=19$m=65536,p=4,t=3$1sUWBnuSn1LxznW4BKyoOA$z5d7YekVJ6PiV+Wvl4NtrzJgaqBtPh8MT9PH4peNiOs',
  'DEV',
  'ACTIVE',
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO NOTHING;
