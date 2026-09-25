import { DataTypes, literal } from 'sequelize'

import type { Migration } from '../connection.js'

/**
 * Everything runs in one transaction. Umzug does not wrap migrations itself,
 * and postgres does transactional DDL, so this is what stops a failure halfway
 * through from leaving the schema half-built and the migration unrecorded.
 */
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.createTable(
      'slack_destinations',
      {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        label: { type: DataTypes.TEXT, allowNull: false },
        webhook_url: { type: DataTypes.TEXT, allowNull: false },
        url_hint: { type: DataTypes.TEXT, allowNull: false },
        created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: literal('now()') },
      },
      { transaction },
    )

    await queryInterface.createTable(
      'sentry_projects',
      {
        slug: { type: DataTypes.TEXT, primaryKey: true },
        name: { type: DataTypes.TEXT, allowNull: true },
        first_seen_at: { type: DataTypes.DATE, allowNull: false, defaultValue: literal('now()') },
        last_seen_at: { type: DataTypes.DATE, allowNull: false, defaultValue: literal('now()') },
      },
      { transaction },
    )

    await queryInterface.createTable(
      'routes',
      {
        project_slug: {
          type: DataTypes.TEXT,
          primaryKey: true,
          references: { model: 'sentry_projects', key: 'slug' },
          onDelete: 'CASCADE',
        },
        destination_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: 'slack_destinations', key: 'id' },
          onDelete: 'RESTRICT',
        },
        enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: literal('now()') },
      },
      { transaction },
    )

    await queryInterface.createTable(
      'settings',
      {
        id: { type: DataTypes.INTEGER, primaryKey: true, defaultValue: 1 },
        last_poll_at: { type: DataTypes.DATE, allowNull: true },
        updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: literal('now()') },
      },
      { transaction },
    )

    // A single settings row, enforced by the database rather than by convention.
    await queryInterface.addConstraint('settings', {
      type: 'check',
      name: 'settings_single_row',
      fields: ['id'],
      where: { id: 1 },
      transaction,
    })

    // bulkInsert has no on-conflict option, and seeding the row must stay
    // harmless against a database that already has it.
    await queryInterface.sequelize.query(
      'insert into settings (id) values (1) on conflict do nothing',
      { transaction },
    )

    await queryInterface.createTable(
      'seen_issues',
      {
        project_slug: { type: DataTypes.TEXT, primaryKey: true },
        issue_id: { type: DataTypes.TEXT, primaryKey: true },
        seen_at: { type: DataTypes.DATE, allowNull: false, defaultValue: literal('now()') },
      },
      { transaction },
    )

    await queryInterface.createTable(
      'deliveries',
      {
        id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
        received_at: { type: DataTypes.DATE, allowNull: false, defaultValue: literal('now()') },
        source: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'polling' },
        project_slug: { type: DataTypes.TEXT, allowNull: true },
        issue_title: { type: DataTypes.TEXT, allowNull: true },
        issue_url: { type: DataTypes.TEXT, allowNull: true },
        destination_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'slack_destinations', key: 'id' },
          onDelete: 'SET NULL',
        },
        outcome: { type: DataTypes.TEXT, allowNull: false },
        detail: { type: DataTypes.TEXT, allowNull: true },
      },
      { transaction },
    )

    await queryInterface.addIndex('deliveries', {
      name: 'deliveries_received_at_idx',
      fields: [{ name: 'received_at', order: 'DESC' }],
      transaction,
    })
  })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async (transaction) => {
    // Dropped children first: routes and deliveries reference slack_destinations.
    await queryInterface.dropTable('deliveries', { transaction })
    await queryInterface.dropTable('seen_issues', { transaction })
    await queryInterface.dropTable('settings', { transaction })
    await queryInterface.dropTable('routes', { transaction })
    await queryInterface.dropTable('sentry_projects', { transaction })
    await queryInterface.dropTable('slack_destinations', { transaction })
  })
}
