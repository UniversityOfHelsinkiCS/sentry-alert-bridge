import { DataTypes, literal, type QueryInterface } from 'sequelize'

import type { Migration } from '../connection.js'

function addProjectForeignKey(
  queryInterface: QueryInterface,
  transaction: unknown,
): Promise<void> {
  return queryInterface.addConstraint('recap_queue', {
    type: 'foreign key',
    name: 'recap_queue_project_fkey',
    fields: ['org_slug', 'project_slug'],
    references: { table: 'sentry_projects', fields: ['org_slug', 'slug'] },
    onDelete: 'CASCADE',
    transaction,
  } as unknown as Parameters<QueryInterface['addConstraint']>[1])
}

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.addColumn(
      'routes',
      'recap_patterns',
      { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      { transaction },
    )

    await queryInterface.addColumn(
      'routes',
      'recap_times',
      { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      { transaction },
    )

    await queryInterface.addColumn(
      'routes',
      'last_recap_at',
      { type: DataTypes.DATE, allowNull: true },
      { transaction },
    )

    await queryInterface.addColumn(
      'sentry_orgs',
      'timezone',
      { type: DataTypes.TEXT, allowNull: true },
      { transaction },
    )

    await queryInterface.createTable(
      'recap_queue',
      {
        org_slug: { type: DataTypes.TEXT, primaryKey: true },
        project_slug: { type: DataTypes.TEXT, primaryKey: true },
        issue_id: { type: DataTypes.TEXT, primaryKey: true },
        issue_title: { type: DataTypes.TEXT, allowNull: false },
        issue_url: { type: DataTypes.TEXT, allowNull: false },
        culprit: { type: DataTypes.TEXT, allowNull: true },
        level: { type: DataTypes.TEXT, allowNull: true },
        short_id: { type: DataTypes.TEXT, allowNull: true },
        event_count: { type: DataTypes.INTEGER, allowNull: true },
        matched_pattern: { type: DataTypes.TEXT, allowNull: false },
        first_queued_at: { type: DataTypes.DATE, allowNull: false, defaultValue: literal('now()') },
        last_queued_at: { type: DataTypes.DATE, allowNull: false, defaultValue: literal('now()') },
        occurrences: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      },
      { transaction },
    )

    await addProjectForeignKey(queryInterface, transaction)

    await queryInterface.addIndex('recap_queue', ['last_queued_at'], {
      name: 'recap_queue_last_queued_at_idx',
      transaction,
    })
  })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.dropTable('recap_queue', { transaction })
    await queryInterface.removeColumn('sentry_orgs', 'timezone', { transaction })
    await queryInterface.removeColumn('routes', 'last_recap_at', { transaction })
    await queryInterface.removeColumn('routes', 'recap_times', { transaction })
    await queryInterface.removeColumn('routes', 'recap_patterns', { transaction })
  })
}
