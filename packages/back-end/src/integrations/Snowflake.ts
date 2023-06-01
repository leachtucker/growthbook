import { SnowflakeConnectionParams } from "../../types/integrations/snowflake";
import { decryptDataSourceParams } from "../services/datasource";
import { runSnowflakeQuery } from "../services/snowflake";
import { MissingDatasourceParamsError } from "../types/Integration";
import { FormatDialect } from "../util/sql";
import SqlIntegration from "./SqlIntegration";

export default class Snowflake extends SqlIntegration {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  params: SnowflakeConnectionParams;
  setParams(encryptedParams: string) {
    this.params = decryptDataSourceParams<SnowflakeConnectionParams>(
      encryptedParams
    );
  }
  getFormatDialect(): FormatDialect {
    return "snowflake";
  }
  getSensitiveParamKeys(): string[] {
    return ["password"];
  }
  runQuery(sql: string) {
    return runSnowflakeQuery(this.params, sql);
  }
  formatDate(col: string): string {
    return `TO_VARCHAR(${col}, 'YYYY-MM-DD')`;
  }
  formatDateTimeString(col: string): string {
    return `TO_VARCHAR(${col}, 'YYYY-MM-DD HH24:MI:SS.MS')`;
  }
  castToString(col: string): string {
    return `TO_VARCHAR(${col})`;
  }
  ensureFloat(col: string): string {
    return `CAST(${col} AS DOUBLE)`;
  }
  getInformationSchemaWhereClause(): string {
    return "table_schema NOT IN ('INFORMATION_SCHEMA')";
  }
  getInformationSchemaTableFromClause(databaseName: string): string {
    return `${databaseName}.information_schema.columns`;
  }
  generateTableName(tableName?: string): string {
    if (!this.params.database)
      throw new MissingDatasourceParamsError(
        "No database provided. In order to get the information schema, you must provide a database."
      );

    if (!tableName) return `${this.params.database}.information_schema.columns`;

    if (!this.params.schema)
      throw new MissingDatasourceParamsError(
        "No schema provided. To automatically generate metrics, you must provide a schema."
      );

    return `${this.params.database}.${this.params.schema}.${tableName}`;
  }
}
