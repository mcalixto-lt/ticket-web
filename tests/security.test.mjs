import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProfile } from '../src/core/security.js';

test('cria perfil somente com nome, CPF e e-mail', async () => {
  const profile = await buildProfile({
    fullName: 'Mauro Calixto da Silva Filho',
    cpf: '529.982.247-25',
    email: 'mauro@example.com',
  });
  assert.equal(profile.fullName, 'Mauro Calixto da Silva Filho');
  assert.equal(profile.email, 'mauro@example.com');
  assert.equal(profile.cpfMasked, '***.982.247-**');
  assert.equal(profile.immutable, true);
  assert.equal('birthDate' in profile, false);
  assert.equal('password' in profile, false);
});

test('rejeita cadastro com CPF inválido', async () => {
  await assert.rejects(
    () => buildProfile({ fullName: 'Mauro Filho', cpf: '111.111.111-11', email: 'mauro@example.com' }),
    /CPF informado não é válido/,
  );
});
