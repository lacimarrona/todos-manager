-- Fix encoding: EFBFBD = U+FFFD (replacement character) caused by latin1 connection
-- Each UPDATE targets only rows matching the known corrupt pattern and replaces with the correct UTF-8 bytes.
-- Uses CONVERT...USING binary to do byte-level REPLACE regardless of connection charset.

-- ventilaci[FFFD]n  →  ventilación   (ó = C3 B3)
UPDATE items_equipo
SET label = CONVERT(REPLACE(CONVERT(label USING binary), 0xEFBFBD, 0xC3B3) USING utf8mb4)
WHERE HEX(label) LIKE '%EFBFBD%' AND label LIKE '%ventilaci%n%';

UPDATE items_revision
SET label = CONVERT(REPLACE(CONVERT(label USING binary), 0xEFBFBD, 0xC3B3) USING utf8mb4)
WHERE HEX(label) LIKE '%EFBFBD%' AND label LIKE '%ventilaci%n%';

UPDATE items_plantilla
SET label = CONVERT(REPLACE(CONVERT(label USING binary), 0xEFBFBD, 0xC3B3) USING utf8mb4)
WHERE HEX(label) LIKE '%EFBFBD%' AND label LIKE '%ventilaci%n%';

-- el[FFFD]ctricas  →  eléctricas   (é = C3 A9)
UPDATE items_equipo
SET label = CONVERT(REPLACE(CONVERT(label USING binary), 0xEFBFBD, 0xC3A9) USING utf8mb4)
WHERE HEX(label) LIKE '%EFBFBD%' AND label LIKE '%l%ctricas%';

UPDATE items_revision
SET label = CONVERT(REPLACE(CONVERT(label USING binary), 0xEFBFBD, 0xC3A9) USING utf8mb4)
WHERE HEX(label) LIKE '%EFBFBD%' AND label LIKE '%l%ctricas%';

UPDATE items_plantilla
SET label = CONVERT(REPLACE(CONVERT(label USING binary), 0xEFBFBD, 0xC3A9) USING utf8mb4)
WHERE HEX(label) LIKE '%EFBFBD%' AND label LIKE '%l%ctricas%';

-- estad[FFFD]sticas  →  estadísticas   (í = C3 AD)
UPDATE items_equipo
SET label = CONVERT(REPLACE(CONVERT(label USING binary), 0xEFBFBD, 0xC3AD) USING utf8mb4)
WHERE HEX(label) LIKE '%EFBFBD%' AND label LIKE '%estad%sticas%';

UPDATE items_revision
SET label = CONVERT(REPLACE(CONVERT(label USING binary), 0xEFBFBD, 0xC3AD) USING utf8mb4)
WHERE HEX(label) LIKE '%EFBFBD%' AND label LIKE '%estad%sticas%';

UPDATE items_plantilla
SET label = CONVERT(REPLACE(CONVERT(label USING binary), 0xEFBFBD, 0xC3AD) USING utf8mb4)
WHERE HEX(label) LIKE '%EFBFBD%' AND label LIKE '%estad%sticas%';

-- Verify: should return 0 rows if all fixed
SELECT 'items_equipo'   as tabla, id, label FROM items_equipo   WHERE HEX(label) LIKE '%EFBFBD%'
UNION ALL
SELECT 'items_revision' as tabla, id, label FROM items_revision WHERE HEX(label) LIKE '%EFBFBD%'
UNION ALL
SELECT 'items_plantilla'as tabla, id, label FROM items_plantilla WHERE HEX(label) LIKE '%EFBFBD%';
