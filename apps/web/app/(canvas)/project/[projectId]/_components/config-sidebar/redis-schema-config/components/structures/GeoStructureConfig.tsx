import React from "react";
import { MapPin } from "lucide-react";
import { BackendNode, isGeoMemberType, isGeoDistanceUnit } from "@/types/canvas";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";

interface GeoStructureConfigProps {
  geoConfig?: BackendNode["data"]["geoConfig"];
  updateData: (changes: Partial<BackendNode["data"]>) => void;
}

export const GeoStructureConfig: React.FC<GeoStructureConfigProps> = ({
  geoConfig,
  updateData,
}) => {
  return (
    <div className="flex flex-col gap-3 pt-3 border-t border-border/40">
      <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
        <MapPin size={12} className="text-red-500" /> Geospatial Coordinate Fields (GEOADD / GEOSEARCH)
      </span>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Longitude Field</Label>
          <Input
            value={geoConfig?.longitudeField || "longitude"}
            onChange={(e) =>
              updateData({
                geoConfig: {
                  longitudeField: e.target.value,
                  latitudeField: geoConfig?.latitudeField || "latitude",
                  memberType: geoConfig?.memberType || "string",
                  distanceUnit: geoConfig?.distanceUnit || "km",
                },
              })
            }
            className="h-7 text-xs font-mono"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Latitude Field</Label>
          <Input
            value={geoConfig?.latitudeField || "latitude"}
            onChange={(e) =>
              updateData({
                geoConfig: {
                  longitudeField: geoConfig?.longitudeField || "longitude",
                  latitudeField: e.target.value,
                  memberType: geoConfig?.memberType || "string",
                  distanceUnit: geoConfig?.distanceUnit || "km",
                },
              })
            }
            className="h-7 text-xs font-mono"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Member Identifier Type</Label>
          <Select
            value={geoConfig?.memberType || "string"}
            onValueChange={(val) => {
              if (isGeoMemberType(val)) {
                updateData({
                  geoConfig: {
                    longitudeField: geoConfig?.longitudeField || "longitude",
                    latitudeField: geoConfig?.latitudeField || "latitude",
                    memberType: val,
                    distanceUnit: geoConfig?.distanceUnit || "km",
                  },
                });
              }
            }}
          >
            <SelectTrigger className="h-7 text-xs font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="string">string (e.g. driver_101)</SelectItem>
              <SelectItem value="uuid">uuid</SelectItem>
              <SelectItem value="number">number</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Default Query Distance Unit</Label>
          <Select
            value={geoConfig?.distanceUnit || "km"}
            onValueChange={(val) => {
              if (isGeoDistanceUnit(val)) {
                updateData({
                  geoConfig: {
                    longitudeField: geoConfig?.longitudeField || "longitude",
                    latitudeField: geoConfig?.latitudeField || "latitude",
                    memberType: geoConfig?.memberType || "string",
                    distanceUnit: val,
                  },
                });
              }
            }}
          >
            <SelectTrigger className="h-7 text-xs font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="km">Kilometers (km)</SelectItem>
              <SelectItem value="m">Meters (m)</SelectItem>
              <SelectItem value="mi">Miles (mi)</SelectItem>
              <SelectItem value="ft">Feet (ft)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
