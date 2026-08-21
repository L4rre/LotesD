// Script de configuración de un solo uso: crea (o resetea la contraseña de)
// la cuenta interna del administrador. Se corre a mano, una vez, desde la
// terminal del desarrollador -- nunca se ejecuta en el navegador ni se
// commitea con secretos reales (ver docs/ARCHITECTURE.md §4).
//
// Uso:
//   SUPABASE_URL=https://tu-proyecto.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key \
//   ADMIN_PASSWORD=admin123 \
//   node scripts/create-admin.mjs
//
// El "usuario" que el administrador escribe en el login (por defecto
// "admin") se traduce internamente a un correo sintético fijo
// (ADMIN_EMAIL) que nunca se muestra en la interfaz.
//
// Supabase Auth exige contraseñas de al menos 6 caracteres -- "admin"
// (5) no alcanza y el script falla con "Password should be at least 6
// characters." Usa algo como "admin123" y cámbialo luego.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@lotesd.internal'
const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123'

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en el entorno.\n' +
      'Este script solo debe correrse localmente, nunca en el frontend.',
  )
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: existing } = await admin.auth.admin.listUsers()
  const found = existing?.users.find((u) => u.email === adminEmail)

  let userId
  if (found) {
    const { data, error } = await admin.auth.admin.updateUserById(found.id, {
      password: adminPassword,
    })
    if (error) throw error
    userId = data.user.id
    console.log(`Contraseña actualizada para ${adminEmail}.`)
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    })
    if (error) throw error
    userId = data.user.id
    console.log(`Cuenta admin creada: ${adminEmail}.`)
  }

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id: userId, role: 'admin', display_name: 'Administrador' })
  if (profileError) throw profileError

  console.log('Listo. En el login, el administrador debe usar "admin" como usuario.')
  if (adminPassword === 'admin123') {
    console.warn('ADVERTENCIA: contraseña por defecto "admin123". Cámbiala antes de usar en producción.')
  }
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
