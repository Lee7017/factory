import { test } from "node:test"
import assert from "node:assert/strict"
import { DEPARTMENTS, FEATURE_NAMES } from "../src/catalog"
import { businessFamilies, businessFamily } from "../src/business/layout"

/** Prevent the old silent fallback: every business route has one declared layout family. */
test("all 51 distinct business pages have exactly one unified family",()=>{
  const routes=DEPARTMENTS.flatMap(dept=>dept.features.map(feature=>({dept:dept.id,feature})))
  const unique=[...new Set(routes.map(route=>route.feature))]
  const classified=Object.entries(businessFamilies).flatMap(([family,features])=>
    features.map(feature=>({family,feature})))
  assert.equal(routes.length,55,"The known 55 department-feature entry points must be covered")
  assert.equal(unique.length,51,"The known 51 distinct business features must be covered")
  assert.deepEqual(
    classified.map(x=>x.feature).sort(),
    unique.slice().sort(),
    "Every feature must occur exactly once in the shared page-family registry"
  )
  for(const {dept,feature} of routes){
    assert.ok(FEATURE_NAMES[feature],`No feature title: ${dept}/${feature}`)
    assert.ok(businessFamily(feature),`No shared family: ${dept}/${feature}`)
  }
  assert.throws(()=>businessFamily("__unclassified__"),/未归类/,
    "New business routes must be assigned to a shared family before being shown")
})
