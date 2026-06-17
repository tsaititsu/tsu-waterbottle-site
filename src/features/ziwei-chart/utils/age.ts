// 實歲：過生日才加一
export function calculateRealAge(birthDateStr: string, queryDate: Date): number {
  const [y, m, d] = birthDateStr.split('-').map(Number);
  const birth = new Date(y, m - 1, d);
  let age = queryDate.getFullYear() - birth.getFullYear();
  const hasHadBirthday =
    queryDate.getMonth() > birth.getMonth() ||
    (queryDate.getMonth() === birth.getMonth() && queryDate.getDate() >= birth.getDate());
  return hasHadBirthday ? age : age - 1;
}

// 虛歲：實歲 + 1
export function calculateNominalAge(birthDateStr: string, queryDate: Date): number {
  return calculateRealAge(birthDateStr, queryDate) + 1;
}
