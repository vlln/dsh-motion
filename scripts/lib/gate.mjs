// One shape for every gate: PASS/FAIL lines, a summary, and the exit code.
export function createGate() {
  const results = [];
  const check = (name, pass, detail = '') => {
    results.push(Boolean(pass));
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  };
  const finish = () => {
    const failed = results.filter((r) => !r).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
  };
  return { check, finish, results };
}
