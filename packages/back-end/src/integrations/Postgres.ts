import { PostgresConnectionParams } from "../../types/integrations/postgres";
import { decryptDataSourceParams } from "../services/datasource";
import { runPostgresQuery } from "../services/postgres";
import { FormatDialect } from "../util/sql";
import SqlIntegration from "./SqlIntegration";

export default class Postgres extends SqlIntegration {
  params!: PostgresConnectionParams;
  setParams(encryptedParams: string) {
    this.params = decryptDataSourceParams<PostgresConnectionParams>(
      encryptedParams
    );
  }
  getFormatDialect(): FormatDialect {
    return "postgresql";
  }
  getSensitiveParamKeys(): string[] {
    return ["password", "caCert", "clientCert", "clientKey"];
  }
  runQuery(sql: string) {
    return runPostgresQuery(this.params, sql);
  }
  getSchema(): string {
    return this.params.defaultSchema || "";
  }
  dateDiff(startCol: string, endCol: string) {
    return `${endCol}::DATE - ${startCol}::DATE`;
  }
  ensureFloat(col: string): string {
    return `${col}::float`;
  }
  formatDate(col: string) {
    return `to_char(${col}, 'YYYY-MM-DD')`;
  }
  formatDateTimeString(col: string): string {
    return `to_char(${col}, 'YYYY-MM-DD HH24:MI:SS.MS')`;
  }
  getInformationSchemaWhereClause(): string {
    return "table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')";
  }
  generateTableName(tableName: string, schemaName?: string): string {
    const schema = schemaName || this.params.defaultSchema;

    if (!schema)
      throw new Error(
        "No default schema provided. Please edit the connection settings and try again."
      );
    return `${schema}.${tableName}`;
  }
}
