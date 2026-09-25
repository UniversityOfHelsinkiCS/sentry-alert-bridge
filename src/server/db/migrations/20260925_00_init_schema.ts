import { DataTypes, literal } from 'sequelize'

import type { Migration } from '../connection.js'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.createTable('slack_destinations', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    label: { type: DataTypes.TEXT, allowNull: false },
    webhook_url: { type: DataTypes.TEXT, allowNull: false },
    url_hint: { type: DataTypes.TEXT, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: literal('now()') },
  })

  await queryInterface.createTable('sentry_projects', {
    slug: { type: DataTypes.TEXT, primaryKey: true },
    name: { type: DataTypes.TEXT, allowNull: true },
    first_seen_at: { type: DataTypes.DATE, allowNull: false, defaultValue: literal('now()') },
    last_seen_at: { type: DataTypes.DATE, allowNull: false, defaultValue: literal('now()') },
  })

  await queryInterface.createTable('routes', {
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
  })

  await queryInterface.createTable('settings', {
    id: { type: DataTypes.INTEGER, primaryKey: true, defaultValue: 1 },
    ingest_mode: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'polling' },
    last_poll_at: { type: DataTypes.DATE, allowNull: true },
    // false until INGEST_MODE_DEFAULT has been applied once; after that the UI
    // owns ingest_mode and the env var is ignored.
    seeded: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: literal('now()') },
  })

  // A single settings row, enforced by the database rather than by convention.
  await queryInterface.addConstraint('settings', {
    type: 'check',
    name: 'settings_single_row',
    fields: ['id'],
    where: { id: 1 },
  })

  await queryInterface.addConstraint('settings', {
    type: 'check',
    name: 'settings_ingest_mode',
    fields: ['ingest_mode'],
    where: { ingest_mode: ['webhook', 'polling'] },
  })

  await queryInterface.bulkInsert('settings', [{ id: 1 }])

  await queryInterface.createTable('seen_issues', {
    project_slug: { type: DataTypes.TEXT, primaryKey: true },
    issue_id: { type: DataTypes.TEXT, primaryKey: true },
    seen_at: { type: DataTypes.DATE, allowNull: false, defaultValue: literal('now()') },
  })

  await queryInterface.createTable('deliveries', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    received_at: { type: DataTypes.DATE, allowNull: false, defaultValue: literal('now()') },
    source: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'webhook' },
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
  })

  await queryInterface.addIndex('deliveries', {
    name: 'deliveries_received_at_idx',
    fields: [{ name: 'received_at', order: 'DESC' }],
  })
}

export const down: Migration = async ({ context: queryInterface }) => {
  // Dropped children first: routes and deliveries reference slack_destinations.
  await queryInterface.dropTable('deliveries')
  await queryInterface.dropTable('seen_issues')
  await queryInterface.dropTable('settings')
  await queryInterface.dropTable('routes')
  await queryInterface.dropTable('sentry_projects')
  await queryInterface.dropTable('slack_destinations')
}
