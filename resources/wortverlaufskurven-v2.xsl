<?xml version="1.0" encoding="utf-8"?>

<xsl:stylesheet
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
  xmlns:w="http://www.w3.org/2000/svg">

<xsl:output
  indent="no"
  encoding="utf-8"/>

<xsl:template match="node()|@*">
  <xsl:copy>
    <xsl:apply-templates select="node()|@*"/>
  </xsl:copy>
</xsl:template>


<!-- REPLACE SUPERFLUOUS TEXT -->

<xsl:template match="//w:g[contains(concat(' ', normalize-space(@class), ' '), ' highcharts-legend-item ')]/w:text/text()">
  <xsl:choose>
    <xsl:when test="contains(current(), ': Gesamt')">
      <xsl:call-template name="replace-string">
        <xsl:with-param name="text" select="current()"/>
        <xsl:with-param name="replace" select="': Gesamt'"/>
        <xsl:with-param name="with" select="''"/>
      </xsl:call-template>
    </xsl:when>
    <xsl:when test="contains(current(), ': Zeitung')">
      <xsl:call-template name="replace-string">
        <xsl:with-param name="text" select="current()"/>
        <xsl:with-param name="replace" select="': Zeitung'"/>
        <xsl:with-param name="with" select="''"/>
      </xsl:call-template>
    </xsl:when>
    <xsl:otherwise>
      <xsl:value-of select="current()"/>
    </xsl:otherwise>
  </xsl:choose>
</xsl:template>

<xsl:template name="replace-string">
  <xsl:param name="text"/>
  <xsl:param name="replace"/>
  <xsl:param name="with"/>
  <xsl:choose>
    <xsl:when test="contains($text, $replace)">
      <xsl:value-of select="substring-before($text, $replace)"/>
      <xsl:value-of select="$with"/>
      <xsl:call-template name="replace-string">
        <xsl:with-param name="text" select="substring-after($text, $replace)"/>
        <xsl:with-param name="replace" select="$replace"/>
        <xsl:with-param name="with" select="$with"/>
      </xsl:call-template>
    </xsl:when>
    <xsl:otherwise>
      <xsl:value-of select="$text"/>
    </xsl:otherwise>
  </xsl:choose>
</xsl:template>

<!-- // REPLACE SUPERFLUOUS TEXT -->


<!-- UNIFY CHART LINE STYLE -->

<xsl:template match="//w:g[contains(concat(' ', normalize-space(@class), ' '), ' highcharts-series ')]/w:path/@stroke-dasharray"/>
<xsl:template match="//w:g[contains(concat(' ', normalize-space(@class), ' '), ' highcharts-legend-item ')]/w:path[1]/@stroke-dasharray"/>

<!-- // UNIFY CHART LINE STYLE -->


<!-- CHANGE CHART COLORS -->

<xsl:param name="color1" select="'#54D1FC'"/>
<xsl:param name="color2" select="'#0000B3'"/>
<xsl:param name="color3" select="'#080'"/>
<xsl:param name="color4" select="'#F7D500'"/>

<!-- color 1 -->
<xsl:template match="//w:g[contains(concat(' ', normalize-space(@class), ' '), ' highcharts-series ')][1]/w:path/@stroke">
  <xsl:attribute name="stroke">
    <xsl:value-of select="$color1"/>
  </xsl:attribute>
</xsl:template>
<xsl:template match="//w:g[contains(concat(' ', normalize-space(@class), ' '), ' highcharts-markers ')][1]/w:path/@fill">
  <xsl:attribute name="fill">
    <xsl:value-of select="$color1"/>
  </xsl:attribute>
</xsl:template>
<xsl:template match="//w:g[contains(concat(' ', normalize-space(@class), ' '), ' highcharts-legend-item ')][1]/w:path[1]/@stroke">
  <xsl:attribute name="stroke">
    <xsl:value-of select="$color1"/>
  </xsl:attribute>
</xsl:template>
<xsl:template match="//w:g[contains(concat(' ', normalize-space(@class), ' '), ' highcharts-legend-item ')][1]/w:path[2]/@fill">
  <xsl:attribute name="fill">
    <xsl:value-of select="$color1"/>
  </xsl:attribute>
</xsl:template>

<!-- color 2 -->
<xsl:template match="//w:g[contains(concat(' ', normalize-space(@class), ' '), ' highcharts-series ')][2]/w:path/@stroke">
  <xsl:attribute name="stroke">
    <xsl:value-of select="$color2"/>
  </xsl:attribute>
</xsl:template>
<xsl:template match="//w:g[contains(concat(' ', normalize-space(@class), ' '), ' highcharts-markers ')][2]/w:path/@fill">
  <xsl:attribute name="fill">
    <xsl:value-of select="$color2"/>
  </xsl:attribute>
</xsl:template>
<xsl:template match="//w:g[contains(concat(' ', normalize-space(@class), ' '), ' highcharts-legend-item ')][2]/w:path[1]/@stroke">
  <xsl:attribute name="stroke">
    <xsl:value-of select="$color2"/>
  </xsl:attribute>
</xsl:template>
<xsl:template match="//w:g[contains(concat(' ', normalize-space(@class), ' '), ' highcharts-legend-item ')][2]/w:path[2]/@fill">
  <xsl:attribute name="fill">
    <xsl:value-of select="$color2"/>
  </xsl:attribute>
</xsl:template>

<!-- color 3 -->
<xsl:template match="//w:g[contains(concat(' ', normalize-space(@class), ' '), ' highcharts-series ')][3]/w:path/@stroke">
  <xsl:attribute name="stroke">
    <xsl:value-of select="$color3"/>
  </xsl:attribute>
</xsl:template>
<xsl:template match="//w:g[contains(concat(' ', normalize-space(@class), ' '), ' highcharts-markers ')][3]/w:path/@fill">
  <xsl:attribute name="fill">
    <xsl:value-of select="$color3"/>
  </xsl:attribute>
</xsl:template>
<xsl:template match="//w:g[contains(concat(' ', normalize-space(@class), ' '), ' highcharts-legend-item ')][3]/w:path[1]/@stroke">
  <xsl:attribute name="stroke">
    <xsl:value-of select="$color3"/>
  </xsl:attribute>
</xsl:template>
<xsl:template match="//w:g[contains(concat(' ', normalize-space(@class), ' '), ' highcharts-legend-item ')][3]/w:path[2]/@fill">
  <xsl:attribute name="fill">
    <xsl:value-of select="$color3"/>
  </xsl:attribute>
</xsl:template>

<!-- color 4 -->
<xsl:template match="//w:g[contains(concat(' ', normalize-space(@class), ' '), ' highcharts-series ')][4]/w:path/@stroke">
  <xsl:attribute name="stroke">
    <xsl:value-of select="$color4"/>
  </xsl:attribute>
</xsl:template>
<xsl:template match="//w:g[contains(concat(' ', normalize-space(@class), ' '), ' highcharts-markers ')][4]/w:path/@fill">
  <xsl:attribute name="fill">
    <xsl:value-of select="$color4"/>
  </xsl:attribute>
</xsl:template>
<xsl:template match="//w:g[contains(concat(' ', normalize-space(@class), ' '), ' highcharts-legend-item ')][4]/w:path[1]/@stroke">
  <xsl:attribute name="stroke">
    <xsl:value-of select="$color4"/>
  </xsl:attribute>
</xsl:template>
<xsl:template match="//w:g[contains(concat(' ', normalize-space(@class), ' '), ' highcharts-legend-item ')][4]/w:path[2]/@fill">
  <xsl:attribute name="fill">
    <xsl:value-of select="$color4"/>
  </xsl:attribute>
</xsl:template>

<!-- // CHANGE CHART COLORS -->


</xsl:stylesheet>
