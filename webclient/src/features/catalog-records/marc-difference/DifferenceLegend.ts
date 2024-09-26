import { MarcFieldDifference } from "../../../adapters/ApiCatalogRecords";

function getDiffernceLegend(difference: MarcFieldDifference) {
    return difference.control_field
        ? `${difference.tag} CTL `
        : `${difference.tag} ${difference.ind1 || "_"} ${
              difference.ind2 || "_"
          } `;
}

export default getDiffernceLegend;
