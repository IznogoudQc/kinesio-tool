import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyBloodPressure, bloodPressureBar } from './clinical.ts'

test('classification PA — systolique', () => {
  assert.equal(classifyBloodPressure(117, 'systolic')!.zone, 'Optimale')
  assert.equal(classifyBloodPressure(125, 'systolic')!.zone, 'Normale')
  assert.equal(classifyBloodPressure(135, 'systolic')!.zone, 'Pré-hypertension')
  assert.equal(classifyBloodPressure(150, 'systolic')!.zone, 'Hypertension 1')
  assert.equal(classifyBloodPressure(170, 'systolic')!.zone, 'Hypertension 2')
})

test('classification PA — diastolique (87 → Pré-hypertension)', () => {
  assert.equal(classifyBloodPressure(87, 'diastolic')!.zone, 'Pré-hypertension')
  assert.equal(classifyBloodPressure(79, 'diastolic')!.zone, 'Optimale')
})

test('barre PA : 5 zones contiguës, repère borné, zone courante alignée', () => {
  const bar = bloodPressureBar(117, 'systolic')!
  assert.equal(bar.zones.length, 5)
  for (let i = 1; i < bar.zones.length; i++) assert.equal(bar.zones[i].min, bar.zones[i - 1].max)
  assert.equal(bar.current!.label, 'Optimale')
  assert.ok(bar.markerRatio! > 0 && bar.markerRatio! < 1)
  // 117 sur [90,180] → (117-90)/90 = 0,3
  assert.ok(Math.abs(bar.markerRatio! - 0.3) < 1e-9)
})

test('barre PA : repère saturé et valeur absente', () => {
  assert.equal(bloodPressureBar(250, 'systolic')!.markerRatio, 1)
  assert.equal(bloodPressureBar(50, 'systolic')!.markerRatio, 0)
  assert.equal(bloodPressureBar(null, 'systolic')!.markerRatio, null)
  assert.equal(bloodPressureBar(null, 'systolic')!.current, null)
})
