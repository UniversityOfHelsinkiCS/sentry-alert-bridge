import { DataTypes, literal, type QueryInterface } from 'sequelize'

import { config } from '../../config.js'
import type { Migration } from '../connection.js'
import { SentryOrg } from '../model/index.js'

const SEED_SLUG = config.SENTRY_ORG_SLUG

const ORG_SCOPED = ['sentry_projects', 'routes', 'seen_issues', 'slack_destinations']

interface CompositeForeignKey {
  name: string
  fields: string[]
  references: { table: string; fields: string[] }
  onDelete: 'CASCADE' | 'RESTRICT'
}

function addCompositeForeignKey(
  queryInterface: QueryInterface,
  table: string,
  constraint: CompositeForeignKey,
  transaction: unknown,
): Promise<void> {
  return queryInterface.addConstraint(table, {
    type: 'foreign key',
    ...constraint,
    transaction,
  } as unknown as Parameters<QueryInterface['addConstraint']>[1])
}

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.createTable(
      'sentry_orgs',
      {
        slug: { type: DataTypes.TEXT, primaryKey: true },
        name: { type: DataTypes.TEXT, allowNull: true },
        auth_token: { type: DataTypes.TEXT, allowNull: false },
        base_url: { type: DataTypes.TEXT, allowNull: true },
        created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: literal('now()') },
      },
      { transaction },
    )

    await SentryOrg.findOrCreate({
      where: { slug: SEED_SLUG },
      defaults: {
        slug: SEED_SLUG,
        name: null,
        authToken: config.SENTRY_AUTH_TOKEN ?? '',
        baseUrl: null,
      },
      transaction,
    })

    for (const table of [...ORG_SCOPED, 'deliveries']) {
      await queryInterface.addColumn(
        table,
        'org_slug',
        { type: DataTypes.TEXT, allowNull: true },
        { transaction },
      )
      await queryInterface.bulkUpdate(table, { org_slug: SEED_SLUG }, {}, { transaction })
    }

    for (const table of ORG_SCOPED) {
      await queryInterface.changeColumn(
        table,
        'org_slug',
        { type: DataTypes.TEXT, allowNull: false },
        { transaction },
      )
    }

    await queryInterface.removeConstraint('routes', 'routes_project_slug_fkey', { transaction })

    for (const [table, fields] of [
      ['sentry_projects', ['org_slug', 'slug']],
      ['routes', ['org_slug', 'project_slug']],
      ['seen_issues', ['org_slug', 'project_slug', 'issue_id']],
    ] as const) {
      await queryInterface.removeConstraint(table, `${table}_pkey`, { transaction })
      await queryInterface.addConstraint(table, {
        type: 'primary key',
        name: `${table}_pkey`,
        fields: [...fields],
        transaction,
      })
    }

    await queryInterface.addConstraint('slack_destinations', {
      type: 'unique',
      name: 'slack_destinations_org_id_key',
      fields: ['org_slug', 'id'],
      transaction,
    })

    await addCompositeForeignKey(
      queryInterface,
      'routes',
      {
        name: 'routes_project_fkey',
        fields: ['org_slug', 'project_slug'],
        references: { table: 'sentry_projects', fields: ['org_slug', 'slug'] },
        onDelete: 'CASCADE',
      },
      transaction,
    )

    await addCompositeForeignKey(
      queryInterface,
      'routes',
      {
        name: 'routes_destination_org_fkey',
        fields: ['org_slug', 'destination_id'],
        references: { table: 'slack_destinations', fields: ['org_slug', 'id'] },
        onDelete: 'RESTRICT',
      },
      transaction,
    )

    for (const table of ['sentry_projects', 'slack_destinations']) {
      await queryInterface.addConstraint(table, {
        type: 'foreign key',
        name: `${table}_org_fkey`,
        fields: ['org_slug'],
        references: { table: 'sentry_orgs', field: 'slug' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
        transaction,
      })
    }
  })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async (transaction) => {
    for (const [table, name] of [
      ['routes', 'routes_destination_org_fkey'],
      ['routes', 'routes_project_fkey'],
      ['sentry_projects', 'sentry_projects_org_fkey'],
      ['slack_destinations', 'slack_destinations_org_fkey'],
      ['slack_destinations', 'slack_destinations_org_id_key'],
    ] as const) {
      await queryInterface.removeConstraint(table, name, { transaction })
    }

    for (const [table, fields] of [
      ['sentry_projects', ['slug']],
      ['routes', ['project_slug']],
      ['seen_issues', ['project_slug', 'issue_id']],
    ] as const) {
      await queryInterface.removeConstraint(table, `${table}_pkey`, { transaction })
      await queryInterface.addConstraint(table, {
        type: 'primary key',
        name: `${table}_pkey`,
        fields: [...fields],
        transaction,
      })
    }

    await queryInterface.addConstraint('routes', {
      type: 'foreign key',
      name: 'routes_project_slug_fkey',
      fields: ['project_slug'],
      references: { table: 'sentry_projects', field: 'slug' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
      transaction,
    })

    for (const table of [...ORG_SCOPED, 'deliveries']) {
      await queryInterface.removeColumn(table, 'org_slug', { transaction })
    }

    await queryInterface.dropTable('sentry_orgs', { transaction })
  })
}
