export const credentialFields = [
  "institution_code",
  "username",
  "display_name",
  "role",
  "password",
];
export function successfulAccounts(results) {
  return results.filter(
    (row) =>
      !row.error &&
      credentialFields.every(
        (key) => typeof row[key] === "string" && row[key].length > 0,
      ),
  );
}
export function credentialsCsv(results) {
  const rows = successfulAccounts(results);
  if (!rows.length)
    throw Error("本批没有可导出的成功账号，请查看下方失败原因。");
  const cell = (value) =>
    '"' +
    String(value)
      .replace(/^[=+@-]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  return (
    "\ufeff" +
    [
      ["机构代码", "用户名", "显示姓名", "角色", "临时密码"],
      ...rows.map((row) => credentialFields.map((key) => row[key])),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n")
  );
}
