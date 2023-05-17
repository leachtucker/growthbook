/* eslint-disable no-console */
import Agenda, { Job } from "agenda";
import uniqid from "uniqid";
import { getDataSourceById } from "../models/DataSourceModel";
import { insertMetrics } from "../models/MetricModel";
import { MetricInterface, MetricType } from "../../types/metric";
import { getSourceIntegrationObject } from "../services/datasource";
import { getInformationSchemaById } from "../models/InformationSchemaModel";
import { fetchTableData } from "../services/informationSchema";
import { getPath } from "../util/informationSchemas";
import { Column } from "../types/Integration";

const CREATE_AUTOMATIC_METRICS_JOB_NAME = "createAutomaticMetrics";

type CreateAutomaticMetricsJob = Job<{
  organization: string;
  datasourceId: string;
  metricsToCreate: {
    event: string;
    hasUserId: boolean;
    createForUser: boolean;
  }[];
}>;

let agenda: Agenda;
export default function (ag: Agenda) {
  agenda = ag;

  agenda.define(
    CREATE_AUTOMATIC_METRICS_JOB_NAME,
    async (job: CreateAutomaticMetricsJob) => {
      console.log("made it to the job");
      const { datasourceId, organization, metricsToCreate } = job.attrs.data;

      if (!datasourceId || !organization || !metricsToCreate) return;

      const datasource = await getDataSourceById(datasourceId, organization);

      if (!datasource) return;

      const integration = getSourceIntegrationObject(datasource);

      if (
        !integration.getAutoGeneratedMetricSqlQuery ||
        !integration.getSourceProperties().supportsAutoGeneratedMetrics
      )
        return;

      const informationSchemaId = datasource.settings.informationSchemaId;

      if (!informationSchemaId) return; //TODO: Throw an error?

      const informationSchema = await getInformationSchemaById(
        organization,
        informationSchemaId
      );

      if (!informationSchema) return; //TODO: Throw an error?

      let informationSchemaTableId = "";

      try {
        const metrics: Partial<MetricInterface>[] = [];
        for (const metric of metricsToCreate) {
          if (metric.createForUser) {
            informationSchema.databases.forEach((database) => {
              database.schemas.forEach((schema) => {
                schema.tables.forEach((table) => {
                  if (table.tableName === metric.event) {
                    informationSchemaTableId = table.id;
                  }
                });
              });
            });

            const {
              tableData,
              databaseName,
              tableSchema,
              tableName,
            } = await fetchTableData(
              datasource,
              informationSchema,
              informationSchemaTableId
            );

            if (!tableData) return; //TODO: Throw an error?

            const columns: Column[] = tableData?.map(
              (row: { column_name: string; data_type: string }) => {
                return {
                  columnName: row.column_name,
                  dataType: row.data_type,
                  path: getPath(datasource.type, {
                    tableCatalog: databaseName,
                    tableSchema: tableSchema,
                    tableName: tableName,
                    columnName: row.column_name,
                  }),
                };
              }
            );

            let metricType: MetricType = "binomial";

            if (columns.length) {
              if (columns.some((column) => column.columnName === "revenue")) {
                metricType = "revenue";
              } else if (
                columns.some((column) => column.columnName === "count")
              ) {
                metricType = "count";
              }
            }
            const sqlQuery = integration.getAutoGeneratedMetricSqlQuery(
              metric,
              integration.settings.schemaFormat || "custom",
              metricType
            );
            metrics.push({
              id: uniqid("met_"),
              organization,
              datasource: datasourceId,
              name: metric.event,
              type: metricType,
              sql: sqlQuery,
              dateCreated: new Date(),
              dateUpdated: new Date(),
            });
          }
        }
        await insertMetrics(metrics);
      } catch (e) {
        // Not sure what to do here yet - catch the errors, but what should I do with them?
      }
    }
  );
}

export async function queueCreateAutomaticMetrics(
  datasourceId: string,
  organization: string,
  metricsToCreate: {
    event: string;
    hasUserId: boolean;
    createForUser: boolean;
  }[]
) {
  if (!datasourceId || !organization || !metricsToCreate) return;

  const job = agenda.create(CREATE_AUTOMATIC_METRICS_JOB_NAME, {
    organization,
    datasourceId,
    metricsToCreate,
  }) as CreateAutomaticMetricsJob;
  job.unique({ datasourceId, organization, metricsToCreate });
  job.schedule(new Date());
  await job.save();
}
