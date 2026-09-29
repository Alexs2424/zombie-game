type Point3 = { x: number; y: number; z: number };
type FrustumPlane = { normal: Point3; d: number };

/** Conservative AABB/frustum test: crossing a plane keeps the whole mesh.
 * Planes must be normalized; padding covers world-space shadow normal bias.
 */
export function intersectsShadowFrustum(
  minimum: Point3,
  maximum: Point3,
  planes: readonly FrustumPlane[],
  padding = 0,
) {
  for (const { normal, d } of planes) {
    // The corner furthest inside this plane determines whether every vertex
    // is outside. NaN bounds deliberately remain included rather than culled.
    const distance = d +
      normal.x * (normal.x >= 0 ? maximum.x : minimum.x) +
      normal.y * (normal.y >= 0 ? maximum.y : minimum.y) +
      normal.z * (normal.z >= 0 ? maximum.z : minimum.z);
    if (distance < -padding) return false;
  }
  return true;
}
