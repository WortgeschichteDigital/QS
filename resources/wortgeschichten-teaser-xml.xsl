<?xml version="1.0" encoding="utf-8"?>

<xsl:stylesheet
	xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
	xmlns:z="http://www.zdl.org/ns/1.0"
	exclude-result-prefixes="z"
	xpath-default-namespace="http://www.zdl.org/ns/1.0">

<xsl:output
	method="xml" media-type="application/xml"
	cdata-section-elements="script style"
	indent="yes"
	encoding="utf-8"
	omit-xml-declaration="yes"/>

<xsl:template match="//z:Artikel">
	<xsl:copy-of select="z:Wortgeschichte_kompakt"/>
</xsl:template>

</xsl:stylesheet>
