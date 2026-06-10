import path from 'node:path';
import chalk from 'chalk';
import prompts from 'prompts';
import {
  deleteSkillInstallDirs,
  pruneMissingSkillInstalls
} from '../installs.js';
import { formatDisplayTime, pickMessage } from '../i18n.js';

function formatInstallTitle(installPath) {
  return path.relative(process.cwd(), installPath) || installPath;
}

function installDescription(item) {
  const verPart = item.version
    ? pickMessage({ zh: `当前版本 ${item.version}`, en: `Current version ${item.version}` })
    : pickMessage({ zh: '当前版本未知', en: 'Unknown version' });
  const idePart = item.ide ? `IDE: ${item.ide}` : '';
  const timePart = item.installedAt
    ? pickMessage({
        zh: `记录时间 ${formatDisplayTime(item.installedAt)}`,
        en: `Recorded ${formatDisplayTime(item.installedAt)}`
      })
    : '';
  return [verPart, idePart, timePart].filter(Boolean).join(' · ');
}

function printDeleteResult(result) {
  if (result.deleted.length > 0) {
    console.log(
      chalk.green(
        pickMessage({
          zh: `已删除 ${result.deleted.length} 个目录：`,
          en: `Deleted ${result.deleted.length} director(ies):`
        })
      )
    );
    for (const item of result.deleted) {
      console.log(chalk.gray(`  - ${formatInstallTitle(item.installPath)}`));
    }
  }

  if (result.skipped.length > 0) {
    console.log(chalk.yellow(pickMessage({ zh: '以下目录未删除：', en: 'Not deleted:' })));
    for (const item of result.skipped) {
      console.log(chalk.gray(`  - ${formatInstallTitle(item.installPath)} (${item.reason})`));
    }
  }
}

export function resolveDeleteTargets(installs, options = {}) {
  if (options.all) return installs;
  const dirs = Array.isArray(options.dir) ? options.dir : options.dir ? [options.dir] : [];
  if (dirs.length === 0) return null;
  const requested = new Set(dirs.map((dir) => path.resolve(dir)));
  return installs.filter((item) => requested.has(item.installPath) || requested.has(path.dirname(item.installPath)));
}

export default async function deleteCommand(skillId, options = {}) {
  const installs = pruneMissingSkillInstalls(skillId);

  if (installs.length === 0) {
    console.log(
      chalk.yellow(
        pickMessage({
          zh: `本地没有记录到 ${skillId} 的安装目录`,
          en: `No local install path recorded for ${skillId}`
        })
      )
    );
    return;
  }

  let selectedInstalls = resolveDeleteTargets(installs, options);

  if (!selectedInstalls) {
    const answer = await prompts([
      {
        type: 'multiselect',
        name: 'installPaths',
        message: pickMessage({
          zh: `选择要删除的 ${skillId} 目录`,
          en: `Select ${skillId} directories to delete`
        }),
        instructions: false,
        choices: [
          {
            title: pickMessage({
              zh: `全部目录（${installs.length} 个）`,
              en: `All directories (${installs.length})`
            }),
            value: '__all__'
          },
          ...installs.map((item) => ({
            title: formatInstallTitle(item.installPath),
            description: installDescription(item),
            value: item.installPath
          }))
        ]
      },
      {
        type: (prev) => {
          if (!prev || prev.length === 0) return null;
          return 'confirm';
        },
        name: 'confirm',
        message: pickMessage({
          zh: '确认删除选中的本地 Skill 目录？此操作不可撤销',
          en: 'Delete selected local Skill directories? This cannot be undone'
        }),
        initial: false
      }
    ]);

    if (!answer.installPaths) {
      console.log(chalk.yellow(pickMessage({ zh: '\n已取消操作', en: '\nCancelled' })));
      return;
    }

    selectedInstalls = answer.installPaths.includes('__all__')
      ? installs
      : installs.filter((item) => answer.installPaths.includes(item.installPath));

    if (!answer.confirm) {
      console.log(chalk.yellow(pickMessage({ zh: '已取消删除', en: 'Delete cancelled' })));
      return;
    }
  }

  if (selectedInstalls.length === 0) {
    console.log(chalk.yellow(pickMessage({ zh: '未选择任何目录，已取消删除', en: 'No directories selected' })));
    return;
  }

  if ((options.all || options.dir) && !options.yes) {
    const answer = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: pickMessage({
        zh: `确认删除 ${selectedInstalls.length} 个本地 Skill 目录？此操作不可撤销`,
        en: `Delete ${selectedInstalls.length} local Skill director(ies)? This cannot be undone`
      }),
      initial: false
    });
    if (!answer.confirm) {
      console.log(chalk.yellow(pickMessage({ zh: '已取消删除', en: 'Delete cancelled' })));
      return;
    }
  }

  const result = deleteSkillInstallDirs(
    skillId,
    selectedInstalls.map((item) => item.installPath)
  );
  printDeleteResult(result);
}
