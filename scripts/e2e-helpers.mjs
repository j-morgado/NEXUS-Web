export async function grantPreviewAccess(target) {
  await target.addInitScript(() => sessionStorage.setItem('nexus:access-granted', 'true'))
}
