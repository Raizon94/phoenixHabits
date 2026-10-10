

PROYECTO: PERSONAL HABIT & FITNESS TRACKER

Quiero que desarrolles una aplicación web completa, moderna y responsive para gestionar mis hábitos diarios, entrenamientos de gimnasio, evolución de peso corporal y estadísticas personales.

La aplicación será exclusivamente para uso personal y debe poder utilizarse desde el ordenador y el móvil.

Quiero una experiencia de usuario similar a una aplicación nativa, con un diseño minimalista, elegante, moderno y muy intuitivo.

La aplicación debe estar preparada para alojarse gratuitamente en Vercel, utilizando Supabase como base de datos y almacenamiento de fotografías.

1. STACK TECNOLÓGICO

Utiliza las siguientes tecnologías:

* React con TypeScript.
* Vite.
* Tailwind CSS.
* Supabase para base de datos PostgreSQL.
* Supabase Storage para fotografías.
* Supabase Auth para autenticación.
* Recharts para gráficos y estadísticas.
* Lucide React para iconos.
* React Router para navegación.
* PWA para poder instalar la aplicación en el móvil.
* Vercel para el despliegue.

Prioriza una arquitectura limpia, escalable y sencilla de mantener.

El proyecto debe funcionar dentro de los límites de los planes gratuitos de Vercel y Supabase.

No quiero depender de servicios de pago.

2. DISEÑO GENERAL

Quiero una aplicación con una interfaz moderna, inspirada en aplicaciones como Hevy, Strong y los mejores habit trackers.

Características visuales:

* Diseño minimalista y premium.
* Modo oscuro como opción principal.
* Posibilidad de cambiar a modo claro.
* Tarjetas con bordes redondeados.
* Animaciones discretas.
* Iconografía moderna.
* Gráficos claros y atractivos.
* Navegación rápida.
* Excelente experiencia en dispositivos móviles.
* Diseño completamente responsive.

En móvil, utiliza una barra de navegación inferior.

En escritorio, utiliza una barra lateral.

La aplicación debe estar en español, pero debe ser fácil añadir otros idiomas en el futuro.

3. ESTRUCTURA DE LA APLICACIÓN

La aplicación tendrá cinco secciones principales:

1. Dashboard.
2. Hábitos.
3. Entrenamiento.
4. Peso y progreso físico.
5. Estadísticas.

También debe incluir una sección de configuración.

⸻

4. DASHBOARD PRINCIPAL

El dashboard será la pantalla inicial.

Debe mostrar un resumen del día actual.

Hábitos diarios

Mostrar los siguientes hábitos:

* Dieta.
* Lectura de la Biblia.
* Rezo.
* 10.000 pasos.
* Gimnasio.

Cada hábito tendrá un icono y un control para marcarlo como completado.

Los hábitos completados deben distinguirse visualmente de los pendientes.

El estado debe guardarse automáticamente en Supabase.

Progreso diario

Mostrar:

* Número de hábitos completados.
* Porcentaje de cumplimiento diario.
* Racha actual de días.
* Resumen semanal.
* Entrenamiento programado para hoy.
* Último peso corporal registrado.

Incluir una barra o anillo de progreso visual.

El dashboard debe actualizarse inmediatamente al completar cualquier hábito.

⸻

5. SISTEMA DE HÁBITOS

Quiero un sistema flexible para gestionar hábitos.

Los hábitos iniciales serán:

1. Dieta.
2. Lectura de la Biblia.
3. Rezo.
4. 10.000 pasos.
5. Gimnasio.

Funcionalidades

Permitir:

* Crear hábitos nuevos.
* Editar hábitos existentes.
* Eliminar o archivar hábitos.
* Cambiar nombres e iconos.
* Asignar colores.
* Establecer objetivos.
* Elegir los días de la semana en los que debe realizarse cada hábito.
* Marcar hábitos como completados.
* Desmarcar hábitos completados.
* Modificar registros de días anteriores.

Tipos de hábitos

Implementar dos tipos:

Binarios:

Se completan o no se completan.

Ejemplos:

* Dieta.
* Rezo.
* Lectura de la Biblia.
* Gimnasio.

Numéricos:

Permiten registrar una cantidad.

Ejemplo:

* Pasos diarios: objetivo 10.000.

En el hábito de pasos quiero poder introducir manualmente el número de pasos realizados.

El hábito se considerará completado automáticamente cuando alcance los 10.000 pasos.

Calendario

Crear una vista mensual que permita visualizar qué hábitos se han completado cada día.

Utilizar indicadores de colores para representar el cumplimiento.

Debe ser posible seleccionar cualquier día y consultar o modificar sus registros.

Rachas

Calcular:

* Racha actual.
* Racha máxima.
* Porcentaje de cumplimiento semanal.
* Porcentaje de cumplimiento mensual.

Las rachas deben tener en cuenta únicamente los días programados para cada hábito.

Los días futuros no deben contabilizarse como incumplimientos.

⸻

6. ENTRENAMIENTO DE GIMNASIO

Esta será una de las funcionalidades más importantes de la aplicación.

Quiero un sistema de seguimiento de entrenamiento inspirado en Hevy.

El objetivo principal es facilitar la sobrecarga progresiva.

6.1. Creación de rutinas

Debo poder crear mis propias rutinas desde la interfaz.

Por ejemplo:

* Push.
* Pull.
* Legs.
* Upper.
* Lower.

Estos son únicamente ejemplos.

No quiero rutinas predefinidas obligatorias.

Debo poder crear, editar, duplicar, reorganizar y eliminar rutinas libremente.

Cada rutina tendrá:

* Nombre.
* Descripción opcional.
* Lista ordenada de ejercicios.

6.2. Gestión de ejercicios

Quiero poder crear mis propios ejercicios.

Cada ejercicio tendrá:

* Nombre.
* Grupo muscular.
* Tipo de ejercicio.
* Notas opcionales.
* Unidad de peso: kg o lb.

Debe existir una biblioteca de ejercicios que pueda reutilizar en distintas rutinas.

También quiero poder:

* Editar ejercicios.
* Eliminar ejercicios.
* Buscar ejercicios.
* Filtrar por grupo muscular.
* Cambiar el orden de los ejercicios dentro de una rutina.

6.3. Series y repeticiones

Cada ejercicio podrá contener un número variable de series.

Cada serie tendrá:

* Número de serie.
* Peso utilizado.
* Repeticiones realizadas.
* Tipo de serie: normal, calentamiento, aproximación o fallo.
* Estado de completado.

Debe ser posible añadir y eliminar series durante el entrenamiento.

Los valores deben poder modificarse directamente desde la interfaz.

Utiliza campos numéricos cómodos para pantallas táctiles.

6.4. FUNCIÓN PRINCIPAL: SOBRECARGA PROGRESIVA

Esta funcionalidad es especialmente importante.

Cuando empiece una nueva sesión de entrenamiento, quiero que la aplicación cargue automáticamente los pesos y repeticiones utilizados en la sesión anterior de cada ejercicio.

Ejemplo:

Entrenamiento anterior

Press banca:

Serie	Peso	Repeticiones
1	60 kg	10
2	65 kg	8
3	65 kg	7

Entrenamiento actual

Al iniciar el nuevo entrenamiento, quiero encontrar esos mismos valores ya escritos:

Serie	Peso	Repeticiones
1	60 kg	10
2	65 kg	8
3	65 kg	7

Entonces podré sobrescribirlos directamente.

Por ejemplo:

Serie	Peso	Repeticiones
1	62,5 kg	10
2	67,5 kg	8
3	67,5 kg	7

Cuando finalice el entrenamiento, estos nuevos valores quedarán guardados.

La próxima vez que realice ese ejercicio, aparecerán automáticamente los valores actualizados.

Requisitos importantes

* Los datos anteriores nunca deben sobrescribirse en la base de datos.
* Cada entrenamiento debe conservar su historial independiente.
* Los valores anteriores deben utilizarse como plantilla editable.
* La aplicación debe guardar una nueva sesión para cada entrenamiento.
* Si modifico una serie durante el entrenamiento, el cambio debe guardarse automáticamente.
* Debe ser posible recuperar un entrenamiento que haya dejado a medias.
* Si añado o elimino series, la siguiente sesión debe utilizar la configuración de la última sesión completada.
* Si un ejercicio aparece en diferentes rutinas, utilizar como referencia su última sesión completada, independientemente de la rutina.
* Mostrar discretamente los valores anteriores para facilitar la comparación.

La experiencia debe ser rápida, sin formularios innecesarios.

6.5. Sesión de entrenamiento

Al pulsar “Iniciar entrenamiento”:

1. Seleccionar una rutina.
2. Crear una nueva sesión.
3. Cargar los ejercicios.
4. Recuperar los pesos y repeticiones anteriores.
5. Permitir editar cada serie.
6. Marcar las series completadas.
7. Guardar los cambios automáticamente.
8. Finalizar el entrenamiento.

Mostrar durante la sesión:

* Nombre de la rutina.
* Tiempo transcurrido.
* Ejercicios.
* Series.
* Pesos.
* Repeticiones.
* Volumen acumulado.

Incluir un botón para finalizar el entrenamiento.

También debe ser posible cancelar una sesión, con confirmación previa.

Al finalizar, mostrar un resumen con:

* Duración.
* Ejercicios realizados.
* Series completadas.
* Volumen total.
* Comparación con la sesión anterior.
* Nuevos récords personales.

Al finalizar una sesión, marcar automáticamente como completado el hábito de gimnasio correspondiente a ese día, siempre que esté programado.

6.6. Historial de entrenamiento

Crear una sección donde pueda consultar todos los entrenamientos realizados.

Permitir:

* Consultar sesiones anteriores.
* Ver los ejercicios realizados.
* Ver pesos y repeticiones.
* Consultar la duración.
* Editar sesiones antiguas.
* Eliminar sesiones.
* Filtrar por fecha y rutina.

Las modificaciones del historial deben actualizar las estadísticas correspondientes.

6.7. Estadísticas de fuerza

Quiero visualizar mi evolución en cada ejercicio.

Mostrar:

* Evolución del peso utilizado.
* Evolución de las repeticiones.
* Volumen total por sesión.
* Mejor serie histórica.
* Récord personal de peso.
* Estimación de 1RM.
* Evolución semanal y mensual.

Utilizar gráficos interactivos.

La estimación de 1RM puede utilizar la fórmula de Epley:

1RM = peso × (1 + repeticiones / 30)

Indicar que es una estimación y no una medición real.

Permitir seleccionar cualquier ejercicio para consultar su evolución.

⸻

7. REGISTRO DE PESO CORPORAL Y FOTOGRAFÍAS

Quiero una sección independiente para registrar mi evolución física.

7.1. Registro diario de peso

Cada día podré introducir mi peso corporal.

Ejemplo:

10/10/2026 — 89,5 kg

Características:

* Introducir peso en kilogramos.
* Permitir decimales.
* Editar registros anteriores.
* Eliminar registros.
* Consultar el historial completo.
* Añadir notas opcionales.
* Seleccionar manualmente la fecha.

Solo debe existir un registro de peso por día y usuario, pero debe poder modificarse.

7.2. Fotografías de progreso

Quiero poder subir fotografías de mi cuerpo para seguir mi evolución física.

Cada fotografía estará asociada a una fecha.

Permitir:

* Subir una o varias fotografías.
* Tomar fotografías directamente desde el móvil.
* Consultar fotografías anteriores.
* Eliminar fotografías.
* Añadir notas.
* Organizar fotografías cronológicamente.

Las fotografías deben almacenarse de forma privada en Supabase Storage.

No deben ser accesibles públicamente.

Utilizar buckets privados, políticas de acceso por usuario y URLs firmadas de corta duración.

Comprimir las fotografías antes de subirlas para ahorrar almacenamiento.

Mantener una calidad suficiente para comparar cambios físicos.

7.3. Comparador de fotografías

Quiero una herramienta para comparar fotografías de distintas fechas.

Debe permitir:

* Seleccionar dos fechas.
* Mostrar las fotografías una al lado de la otra.
* Compararlas mediante un deslizador visual.
* Consultar el peso registrado en cada fecha.
* Mostrar la diferencia de peso entre ambas fechas.

La comparación debe funcionar correctamente en móvil.

7.4. Gráfico de evolución del peso

Crear un gráfico interactivo con:

* Peso diario.
* Media móvil de 7 días.
* Tendencia general.
* Peso inicial.
* Peso actual.
* Peso mínimo registrado.
* Peso máximo registrado.
* Variación total.
* Variación semanal.
* Variación mensual.

Permitir filtrar por:

* Últimos 7 días.
* Últimos 30 días.
* Últimos 90 días.
* Últimos 6 meses.
* Último año.
* Todo el historial.

También quiero poder configurar un peso objetivo.

Mostrar cuánto falta para alcanzar ese objetivo.

No utilizar mensajes negativos ni juicios de valor sobre el peso.

⸻

8. ESTADÍSTICAS GENERALES

Crear una sección de estadísticas que centralice toda la información.

8.1. Estadísticas de hábitos

Mostrar:

* Porcentaje de cumplimiento por hábito.
* Cumplimiento global.
* Rachas actuales.
* Rachas máximas.
* Evolución semanal.
* Evolución mensual.
* Días con todos los hábitos completados.
* Hábitos con mayor constancia.

Incluir un calendario de actividad estilo GitHub, donde cada día tenga una intensidad visual según el porcentaje de hábitos completados.

8.2. Estadísticas de entrenamiento

Mostrar:

* Entrenamientos por semana.
* Entrenamientos por mes.
* Tiempo total entrenado.
* Volumen total levantado.
* Evolución de fuerza.
* Récords personales.
* Frecuencia por grupo muscular.
* Número total de series realizadas.

8.3. Estadísticas corporales

Mostrar:

* Evolución del peso.
* Variación acumulada.
* Promedios semanales.
* Tendencias mensuales.
* Comparaciones entre periodos.
* Evolución respecto al objetivo.

8.4. Filtros

Todos los gráficos deben permitir seleccionar periodos.

Utilizar Recharts y diseñar gráficos adaptados a dispositivos móviles.

No calcular estadísticas únicamente sobre los datos cargados en pantalla.

Las estadísticas deben considerar todos los registros correspondientes al periodo seleccionado.

⸻

9. BASE DE DATOS

Diseña una estructura PostgreSQL normalizada.

Como mínimo, contempla las siguientes entidades:

* profiles
* habits
* habit_logs
* exercises
* workout_routines
* routine_exercises
* routine_sets
* workout_sessions
* workout_exercises
* workout_sets
* body_weight_logs
* progress_photos
* user_settings

Puedes añadir tablas adicionales cuando sea necesario.

Requisitos

* Utilizar UUID como identificadores.
* Asociar los datos al usuario autenticado.
* Utilizar claves foráneas.
* Añadir índices adecuados.
* Establecer restricciones de integridad.
* Crear migraciones SQL reproducibles.
* Implementar políticas Row Level Security.
* Impedir que un usuario acceda a los datos de otro.
* Proteger todas las operaciones de lectura, escritura y eliminación.

La aplicación debe utilizar Supabase Auth.

No quiero que otros usuarios puedan acceder a mis datos.

No expongas claves privadas ni service_role keys en el frontend.

Utiliza exclusivamente las credenciales públicas necesarias y protege los datos mediante RLS.

⸻

10. PERSISTENCIA Y SINCRONIZACIÓN

Los datos deben guardarse automáticamente.

Especialmente durante los entrenamientos, no quiero perder información si cierro accidentalmente la aplicación.

Implementa:

* Guardado automático.
* Indicadores discretos del estado de sincronización.
* Recuperación de entrenamientos incompletos.
* Gestión de errores de conexión.
* Prevención de duplicados.
* Actualizaciones optimistas cuando sea apropiado.

Si la conexión falla, conserva temporalmente los cambios pendientes en almacenamiento local y sincronízalos cuando vuelva la conexión.

Evita sobrescribir silenciosamente datos más recientes cuando se utilicen varios dispositivos.

⸻

11. EXPERIENCIA MÓVIL Y PWA

Quiero poder instalar la aplicación en mi móvil como una PWA.

Implementar:

* Manifest.
* Iconos.
* Service Worker.
* Instalación desde el navegador.
* Diseño responsive.
* Barra inferior de navegación.
* Compatibilidad con Safari en iPhone.
* Compatibilidad con Chrome en Android.
* Áreas táctiles suficientemente grandes.
* Respeto de las zonas seguras del dispositivo.
* Pantallas de carga y estados vacíos.

La aplicación debe abrirse rápidamente.

No es necesario implementar notificaciones push en la primera versión.

⸻

12. CONFIGURACIÓN

Crear una sección de ajustes que permita:

* Cambiar entre modo oscuro y claro.
* Configurar el peso objetivo.
* Elegir la unidad de peso.
* Gestionar hábitos.
* Gestionar ejercicios.
* Gestionar rutinas.
* Cambiar contraseña.
* Cerrar sesión.
* Exportar los datos.

Exportación

Quiero poder exportar:

* Historial de hábitos.
* Historial de entrenamientos.
* Historial de peso corporal.

Permitir exportar los datos en CSV y JSON.

También quiero una opción de copia de seguridad completa que incluya los registros y las fotografías.

La copia de seguridad debe poder restaurarse sin duplicar registros.

⸻

13. REQUISITOS DE CALIDAD

El código debe ser:

* Modular.
* Tipado con TypeScript.
* Fácil de mantener.
* Reutilizable.
* Escalable.
* Seguro.

Organiza el proyecto utilizando carpetas para:

* Components.
* Pages.
* Hooks.
* Services.
* Types.
* Utils.
* Contexts.
* Database.
* Styles.

Utiliza una gestión de estado sencilla y evita dependencias innecesarias.

Implementa validación de formularios y manejo adecuado de errores.

Añade confirmaciones antes de eliminar información importante.

La aplicación debe ser accesible mediante teclado y lectores de pantalla en sus funciones principales.

Utiliza formatos de fecha españoles y semanas que comiencen en lunes.

Los registros diarios deben respetar la zona horaria configurada por el usuario, evitando errores por conversiones UTC.

⸻

14. DESPLIEGUE

El proyecto debe estar preparado para publicarse en Vercel.

Incluye:

* Configuración de producción.
* Variables de entorno.
* Archivo .env.example.
* Migraciones SQL.
* Instrucciones para configurar Supabase.
* Instrucciones para configurar Supabase Storage.
* Instrucciones para conectar GitHub con Vercel.
* Configuración necesaria para que React Router funcione al actualizar una ruta.
* README completo.

Nunca incluyas contraseñas ni claves secretas en el repositorio.

⸻

15. ORDEN DE DESARROLLO

No quiero que intentes desarrollar todas las funcionalidades de forma desordenada.

Trabaja por fases.

FASE 1 — Arquitectura y diseño

* Crear proyecto.
* Configurar dependencias.
* Diseñar estructura de carpetas.
* Configurar navegación.
* Implementar tema oscuro y claro.
* Crear componentes visuales reutilizables.

FASE 2 — Base de datos y autenticación

* Diseñar esquema.
* Crear migraciones.
* Configurar Supabase.
* Implementar autenticación.
* Implementar políticas de seguridad.

FASE 3 — Hábitos

* CRUD de hábitos.
* Registros diarios.
* Calendario.
* Dashboard.
* Rachas.

FASE 4 — Entrenamientos

* Biblioteca de ejercicios.
* Gestión de rutinas.
* Gestión de series.
* Sesiones de entrenamiento.
* Recuperación automática de pesos anteriores.
* Guardado automático.
* Historial de sesiones.
* Sobrecarga progresiva.

Esta fase es prioritaria y debe funcionar perfectamente antes de continuar.

FASE 5 — Peso y fotografías

* Registro de peso.
* Historial.
* Gráficos.
* Subida privada de fotografías.
* Galería.
* Comparador de fotografías.

FASE 6 — Estadísticas

* Estadísticas de hábitos.
* Estadísticas de entrenamiento.
* Estadísticas corporales.
* Filtros y gráficos.

FASE 7 — PWA y despliegue

* Optimización móvil.
* Configuración PWA.
* Pruebas.
* Despliegue en Vercel.
* Documentación final.

⸻

16. INSTRUCCIONES IMPORTANTES PARA CLAUDE CODE

Antes de comenzar:

1. Analiza los requisitos.
2. Propón la arquitectura y estructura de carpetas.
3. Identifica las decisiones técnicas que puedan afectar al funcionamiento futuro.
4. Explica brevemente cómo organizarás la base de datos.
5. Crea un plan de implementación por fases.

Después, comienza a implementar la primera fase.

No te limites a proporcionar ejemplos de código.

Quiero archivos reales, componentes funcionales y una aplicación ejecutable.

No utilices datos simulados como sustituto de la persistencia real en las funcionalidades terminadas.

Cuando una fase esté terminada:

* Comprueba que el proyecto compila.
* Ejecuta las pruebas disponibles.
* Corrige los errores detectados.
* Comprueba la integración con las fases anteriores.
* Explica qué se ha implementado.
* Indica qué queda pendiente.

Añade pruebas para la lógica crítica, especialmente:

* Cálculo de rachas.
* Recuperación de series anteriores.
* Guardado de sesiones.
* Cálculo del volumen.
* Estadísticas de peso.
* Seguridad de acceso a datos.

No avances a la siguiente fase hasta que la fase actual funcione correctamente.

Si necesitas que configure un servicio externo, como Supabase, indícame exactamente qué debo hacer.

No inventes credenciales.

Prioriza siempre una aplicación funcional, rápida y sencilla de utilizar frente a funcionalidades visuales innecesarias.

OBJETIVO FINAL:

Crear mi propia aplicación personal de hábitos y entrenamiento, accesible desde cualquier dispositivo, que me permita registrar mi disciplina diaria, mejorar progresivamente en el gimnasio, controlar mi evolución corporal mediante peso y fotografías y consultar estadísticas detalladas de todo mi progreso.

