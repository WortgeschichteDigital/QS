<?xml version="1.0" encoding="utf-8"?>

<xsl:stylesheet
	xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
	xmlns:z="http://www.zdl.org/ns/1.0"
	exclude-result-prefixes="z"
	xpath-default-namespace="http://www.zdl.org/ns/1.0">

<xsl:output
	method="html" media-type="text/html"
	cdata-section-elements="script style"
	indent="no"
	encoding="utf-8"/>

<xsl:template match="//z:Artikel">
	<xsl:apply-templates select="z:Wortgeschichte_kompakt"/>
</xsl:template>

<xsl:template match="z:Ueberschrift"/>

<xsl:template match="z:Textblock">
	<p class="wgd-textblock">
		<xsl:apply-templates/>
	</p>
</xsl:template>

<xsl:template match="z:erwaehntes_Zeichen">
	<span class="wgd-ez">
		<xsl:apply-templates/>
	</span>
</xsl:template>

<xsl:template match="z:Fundstelle/z:unstrukturiert">
	<xsl:text>„</xsl:text>
	<xsl:apply-templates/>
	<xsl:text>“</xsl:text>
</xsl:template>

<xsl:template match="z:Hervorhebung">
	<xsl:choose>
		<xsl:when test="@Stil = '#b'">
			<b>
			<xsl:apply-templates/>
			</b>
		</xsl:when>
		<xsl:when test="@Stil = '#u'">
			<u>
			<xsl:apply-templates/>
			</u>
		</xsl:when>
		<xsl:otherwise>
			<i>
			<xsl:apply-templates/>
			</i>
		</xsl:otherwise>
	</xsl:choose>
</xsl:template>

<xsl:template match="z:Paraphrase">
	<xsl:text>›</xsl:text>
	<xsl:apply-templates/>
	<xsl:text>‹</xsl:text>
</xsl:template>

<xsl:template match="z:sogenannt">
	<xsl:text>‚</xsl:text>
	<xsl:apply-templates/>
	<xsl:text>‘</xsl:text>
</xsl:template>

<xsl:template match="z:Stichwort">
	<span class="wgd-stichwort">
		<xsl:apply-templates/>
	</span>
</xsl:template>

<xsl:template match="z:Verweis">
	<xsl:apply-templates select="z:Verweistext"/>
</xsl:template>

<xsl:template match="z:Zitat">
	<xsl:text>„</xsl:text>
	<xsl:apply-templates/>
	<xsl:text>“</xsl:text>
</xsl:template>

</xsl:stylesheet>
